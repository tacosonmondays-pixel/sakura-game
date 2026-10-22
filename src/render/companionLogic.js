// Pure state rules of the companion actors (src/render/companions.js): no three.js, no DOM, no sim
// writes, so they are unit-tested in node (tests/render/companions.test.js). Positions are world units
// on the board: x = sim x, z = sim y, y = height.
//
//   Kon (Ruri):  home (sits by her) → travel (runs along the ground) → spot (sits at her relay origin)
//   Kaze (Hana): a swoop = out to the target and back in a short arc; one in flight at a time
//   doll (Yoriko): a dash = the same out-and-back, short and low, stopping short of the target

/** Kon's running speed (tiles / s). */
export const KON_SPEED = 2.4;
/** A relay origin this close to Ruri means no relay spot: Kon sits by her. */
export const KON_SELF = 0.3;
/** Kaze's swoop: seconds out and back, arc height (tiles). */
export const SWOOP_TIME = 0.95;
export const SWOOP_LIFT = 0.45;
/** The doll's dash: seconds out and back, how far it goes at most, how short of the target it stops. */
export const DASH_TIME = 0.67;
export const DASH_REACH = 1.3;
export const DASH_STOP = 0.35;
export const DASH_LIFT = 0.12;

/** @returns {{ mode: 'home'|'travel'|'spot', x: number, z: number, tx: number, tz: number, hold: number, placed: boolean, dx: number, dz: number }} */
export function konState() {
  return { mode: 'home', x: 0, z: 0, tx: 0, tz: 0, hold: 0, placed: false, dx: 0, dz: 1 };
}

/**
 * Ruri's relay spot for Kon, or null when her origin is at (or right by) her own spot.
 * @param {{ x: number, y: number, ox?: number, oy?: number, origin?: object|null }} t sim tower (read only)
 * @param {{ x: number, z: number }} out
 */
export function konSpot(t, out) {
  if (!t || !t.origin || t.ox == null || t.oy == null) return null;
  if (Math.hypot(t.ox - t.x, t.oy - t.y) < KON_SELF) return null;
  out.x = t.ox;
  out.z = t.oy;
  return out;
}

/**
 * One frame of Kon. He starts by Ruri (his appear plays there, `hold` seconds), then runs to her relay spot,
 * sits there, runs to a new spot when it moves, and runs back when the spot goes away.
 * @param {ReturnType<typeof konState>} s mutated
 * @param {number} dt
 * @param {number} homeX @param {number} homeZ where he sits by Ruri this frame
 * @param {{ x: number, z: number }|null} spot
 * @param {number} [speed]
 */
export function konStep(s, dt, homeX, homeZ, spot, speed = KON_SPEED) {
  if (!s.placed) {
    s.placed = true;
    s.mode = 'home';
    s.x = homeX;
    s.z = homeZ;
  }
  if (s.hold > 0) {
    s.hold = Math.max(0, s.hold - dt);
    if (s.mode === 'home') {
      s.x = homeX;
      s.z = homeZ;
      return s;
    }
  }
  const toHome = !spot;
  const tx = toHome ? homeX : spot.x;
  const tz = toHome ? homeZ : spot.z;
  if (toHome && s.mode === 'home') {
    s.x = homeX;
    s.z = homeZ;
    return s;
  }
  if (!toHome && s.mode === 'spot' && Math.abs(s.tx - tx) < 1e-6 && Math.abs(s.tz - tz) < 1e-6) return s;
  s.mode = 'travel';
  s.tx = tx;
  s.tz = tz;
  const dx = tx - s.x;
  const dz = tz - s.z;
  const d = Math.hypot(dx, dz);
  const step = Math.max(0, speed * dt);
  if (d > 1e-6) {
    s.dx = dx;
    s.dz = dz;
  }
  if (d <= step || d < 1e-4) {
    s.x = tx;
    s.z = tz;
    s.mode = toHome ? 'home' : 'spot';
  } else {
    s.x += (dx / d) * step;
    s.z += (dz / d) * step;
  }
  return s;
}

/**
 * Kon acts on Ruri's bolts whenever he is not running somewhere: at her relay spot, or at his guard
 * post by her when her origin is her own spot (FX-1: he used to sit through the whole battle there).
 */
export function konAttacks(s) {
  return s.mode !== 'travel';
}

// ---- Kon's intent (FX-1): a companion always looks at something and always wants something ---------
//
//   guard   an enemy within range: crouched, head tracking it, small side-steps along the lane
//   hop     each bolt: a real hop toward the target, out and back (the bolt leaves at its top; the hop
//           starts early from Ruri's own cooldown so the apex lands on the shot)
//   pounce  every 4th bolt, a crit or a kill: a high mousing leap nose-first, a landing squash, a
//           shake of his head, then a trot back
//   patrol  a wave on and nothing in range for 2 s: a small figure-eight round his post, sniffing
//   play    between waves: a tail chase, a roll, a scratch, a pounce at nothing, or a trot to Ruri for
//           a pat (she gets a heart), with short sits in between
//   rest    nothing for 20 s: he curls up by Ruri and sleeps; an enemy coming near wakes him, ears up
// He always stays within KON.LEASH tiles of the sim's bolt origin (so the bolts leaving him stay true).
// Reduce Motion: no travel, hops or spins: he re-projects (a short fade out and in) instead of running,
// yips in place for a bolt, and between waves only sits, looks round and yawns.
// Display randomness comes from his uid and a counter (never Math.random).

export const KON = {
  HOP_T: 0.35, HOP_OUT: 0.25, HOP_H: 0.12,
  POUNCE_T: 0.45, POUNCE_OUT: 0.6, POUNCE_H: 0.45, LAND_T: 0.12, SHAKE_T: 0.3, EVERY: 4,
  TROT: 1.6, LEASH: 0.6,
  STEP: 0.2, STEP_MIN: 1.5, STEP_MAX: 2.5,
  PATROL_AFTER: 2, PATROL_R: 0.3, PATROL_W: 1.4, SNIFF_EVERY: 3.2, SNIFF: 1.2,
  PLAY_AFTER: 1.5, SIT_MIN: 1.5, SIT_MAX: 3, PAT: 1.4,
  REST_AFTER: 20, WAKE: 0.35,
  FADE: 0.15, YIP_H: 0.03,
};

const PLAYS = ['tail', 'roll', 'scratch', 'chase', 'pat'];
const CALM_PLAYS = ['sit', 'yawn', 'look'];

/** Seeded display random in [0, 1) from his uid and a counter. */
function rnd(b) {
  b.n = (b.n + 1) | 0;
  let h = (Math.imul((b.uid | 0) ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul(b.n, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** A fresh brain for Kon of Ruri `uid`. Outputs: x, z, h, yaw, pitch, roll, head, headPitch, sy, clip, fade, heart, sleep. */
export function konBrain(uid = 1) {
  return {
    uid, n: 0, act: 'guard', sub: '', t: 0, clock: 0,
    x: 0, z: 0, h: 0, yaw: 0, pitch: 0, roll: 0, head: 0, headPitch: 0, sy: 1, clip: 'idle', fade: 1, heart: false, sleep: false,
    placed: false, quiet: 0, idle: 0, bolts: 0, side: 0, sideTo: 0, stepT: 1, sniffT: KON.SNIFF_EVERY,
    sx: 0, sz: 0, tx: 0, tz: 0, dur: 0, next: '', bolt: false, btx: 0, btz: 0, bbig: false, pre: false, sitT: 0, fadeT: -1, fx: 0, fz: 0,
  };
}

/** Queues a bolt reaction (Ruri's attack event; tx, tz the target; big = a crit or a kill). */
export function konBolt(b, tx, tz, big = false) {
  b.bolt = true;
  b.btx = tx;
  b.btz = tz;
  b.bolts++;
  b.bbig = !!big || b.bolts % KON.EVERY === 0;
}

/**
 * Kon's guard post: the relay origin when it is away from Ruri; else a spot in front of her on the
 * camera side. Either way it is slid sideways when it would sit straight behind her from the camera
 * (hidden by her hair), as far as the leash allows. (camX, camZ): the ground direction toward the camera.
 * @returns {{ x: number, z: number }} out
 */
export function konPost(t, camX, camZ, out) {
  const cl = Math.hypot(camX, camZ) || 1;
  const cx = camX / cl;
  const cz = camZ / cl;
  // the camera's right on the ground
  const rx = cz;
  const rz = -cx;
  const ox = t.ox ?? t.x;
  const oz = t.oy ?? t.y;
  if (!t.origin || Math.hypot(ox - t.x, oz - t.y) < KON_SELF) {
    out.x = t.x + cx * 0.38 + rx * 0.24;
    out.z = t.y + cz * 0.38 + rz * 0.24;
    return out;
  }
  out.x = ox;
  out.z = oz;
  // behind her from the camera (and not far to one side): slide it sideways, within the leash
  const dx = ox - t.x;
  const dz = oz - t.y;
  const behind = -(dx * cx + dz * cz);
  const lateral = dx * rx + dz * rz;
  if (behind > 0 && Math.abs(lateral) < 0.45) {
    const sgn = lateral >= 0 ? 1 : -1;
    const shift = Math.min(KON.LEASH * 0.85, 0.45 - Math.abs(lateral));
    out.x += rx * sgn * shift;
    out.z += rz * sgn * shift;
  }
  return out;
}

/**
 * The road direction nearest (x, z): the unit direction of the closest path segment (sim path data,
 * read only). Writes out.x / out.z; (0, 1) when there is no road.
 */
export function laneDirAt(paths, x, z, out) {
  let best = Infinity;
  out.x = 0;
  out.z = 1;
  for (const path of paths || []) {
    const pts = path.points;
    const dirs = path.dirs;
    if (!pts || !dirs) continue;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0];
      const ay = pts[i][1];
      const ex = pts[i + 1][0] - ax;
      const ey = pts[i + 1][1] - ay;
      const len2 = ex * ex + ey * ey;
      let k = len2 > 0 ? ((x - ax) * ex + (z - ay) * ey) / len2 : 0;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const px = ax + ex * k - x;
      const py = ay + ey * k - z;
      const d = px * px + py * py;
      if (d < best) {
        best = d;
        out.x = dirs[i][0];
        out.z = dirs[i][1];
      }
    }
  }
  return out;
}

/** Where he sits by Ruri (a pat, his nap): beside her on the camera side, never behind her. */
export function konHome(rx0, rz0, camX, camZ, out) {
  const cl = Math.hypot(camX, camZ) || 1;
  const cx = camX / cl;
  const cz = camZ / cl;
  out.x = rx0 + cx * 0.3 + cz * 0.3;
  out.z = rz0 + cz * 0.3 - cx * 0.3;
  return out;
}

/**
 * Clamps (x, z) to within KON.LEASH of the bolt origin while bolts can fly (a wave, or an enemy near);
 * between waves he may trot anywhere (to Ruri for a pat, his nap). Writes b.fx / b.fz.
 */
function leash(b, I, x, z) {
  const dx = x - I.ox;
  const dz = z - I.oz;
  const d = Math.hypot(dx, dz);
  if (d <= KON.LEASH || d < 1e-9 || !(I.wave || I.near || I.enemy)) {
    b.fx = x;
    b.fz = z;
  } else {
    b.fx = I.ox + (dx / d) * KON.LEASH;
    b.fz = I.oz + (dz / d) * KON.LEASH;
  }
}

function start(b, act, sub = '') {
  b.act = act;
  b.sub = sub;
  b.t = 0;
}

/** Starts a trot (or, calm, a re-projection) from where he is to (x, z), then `next` (and its sub-act). */
function moveTo(b, I, x, z, next, nextSub = '') {
  leash(b, I, x, z);
  b.sx = b.x;
  b.sz = b.z;
  b.tx = b.fx;
  b.tz = b.fz;
  const d = Math.hypot(b.tx - b.sx, b.tz - b.sz);
  b.next = next;
  b.nextSub = nextSub;
  if (d < 0.02) {
    start(b, next, nextSub);
    return;
  }
  if (I.calm) {
    start(b, 'blink');
    b.dur = KON.FADE * 2;
    return;
  }
  start(b, 'trot');
  b.dur = d / KON.TROT;
}

function face(b, x, z, dt, rate = 12) {
  const dx = x - b.x;
  const dz = z - b.z;
  if (dx * dx + dz * dz < 1e-6) return;
  const want = Math.atan2(dx, dz);
  let d = (want - b.yaw) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  b.yaw += d * Math.min(1, dt * rate);
}

/** Where he guards: his post plus the current side-step along the lane. */
function guardSpot(b, I) {
  leash(b, I, I.px + I.lx * b.side, I.pz + I.lz * b.side);
}

/** Starts a hop (or a pounce) at the target (tx, tz). */
function leap(b, I, tx, tz, big) {
  const dx = tx - b.x;
  const dz = tz - b.z;
  const d = Math.hypot(dx, dz) || 1;
  b.sx = b.x;
  b.sz = b.z;
  if (big) {
    const go = Math.min(KON.POUNCE_OUT, d * 0.9);
    leash(b, I, b.x + (dx / d) * go, b.z + (dz / d) * go);
    b.tx = b.fx;
    b.tz = b.fz;
    start(b, 'pounce');
  } else {
    const go = Math.min(KON.HOP_OUT, d * 0.6);
    leash(b, I, b.x + (dx / d) * go, b.z + (dz / d) * go);
    b.tx = b.fx;
    b.tz = b.fz;
    start(b, 'hop');
  }
  b.yaw = Math.atan2(dx, dz);
}

/**
 * One frame of Kon's intent at his post. Call it while the travel layer (konStep) has him settled
 * (mode 'spot', or 'home' with no post). Mutates `b` (the outputs are on it).
 * @param {object} b konBrain()
 * @param {number} dt seconds (the renderer's visual clock)
 * @param {{ px: number, pz: number, hx: number, hz: number, ox: number, oz: number, lx: number, lz: number,
 *   enemy: boolean, ex: number, ez: number, near: boolean, wave: boolean, calm: boolean,
 *   cooldown?: number, engaged?: boolean }} I post, home (by Ruri), the sim's bolt origin, the lane's
 *   direction at the post, the nearest enemy within range (+0.5) and whether one is within range + 1.5,
 *   a wave running, Reduce Motion, Ruri's own countdown to her next bolt and whether she is firing
 */
export function konBrainStep(b, dt, I) {
  if (!b.placed) {
    b.placed = true;
    b.x = I.px;
    b.z = I.pz;
  }
  b.t += dt;
  b.clock += dt;
  b.heart = false;
  b.sleep = false;
  b.pitch = 0;
  b.roll = 0;
  b.headPitch = 0;
  b.h = 0;
  b.sy = 1;
  b.fade = 1;
  b.clip = 'idle';
  if (I.enemy) {
    b.quiet = 0;
    b.idle = 0;
  } else {
    b.quiet += dt;
    b.idle += dt;
  }
  // a bolt: hop (or pounce) at its target, unless a pre-rolled hop is already on its way up
  if (b.bolt) {
    b.bolt = false;
    b.idle = 0;
    const busy = (b.act === 'pounce' && b.t < KON.POUNCE_T) || (b.act === 'hop' && b.pre && b.t < KON.HOP_T);
    b.pre = false;
    if (!busy) leap(b, I, b.btx, b.btz, b.bbig && !I.calm);
  } else if (I.engaged && I.cooldown > 0 && I.cooldown <= KON.HOP_T * 0.5 && I.enemy && b.act === 'guard' && !I.calm) {
    // pre-roll: the hop starts from Ruri's own countdown so its top lands on the shot
    leap(b, I, I.ex, I.ez, false);
    b.pre = true;
  }
  switch (b.act) {
    case 'hop': {
      const k = Math.min(1, b.t / KON.HOP_T);
      const u = Math.sin(Math.PI * k);
      if (I.calm) {
        b.x = b.sx;
        b.z = b.sz;
        b.h = KON.YIP_H * u;
      } else {
        b.x = b.sx + (b.tx - b.sx) * u;
        b.z = b.sz + (b.tz - b.sz) * u;
        b.h = KON.HOP_H * u;
        b.sy = k < 0.15 ? 0.88 : k > 0.85 ? 0.9 : 1.06;
      }
      b.clip = 'attack';
      if (k >= 1) start(b, 'guard');
      break;
    }
    case 'pounce': {
      const T = KON.POUNCE_T;
      if (b.t < T) {
        const k = b.t / T;
        b.x = b.sx + (b.tx - b.sx) * k;
        b.z = b.sz + (b.tz - b.sz) * k;
        b.h = KON.POUNCE_H * 4 * k * (1 - k);
        b.pitch = -0.6 + 1.2 * k; // nose up, then nose first into the landing
        b.sy = 1.08;
        b.clip = 'attack';
      } else if (b.t < T + KON.LAND_T + KON.SHAKE_T) {
        b.x = b.tx;
        b.z = b.tz;
        const u = b.t - T;
        if (u < KON.LAND_T) b.sy = u < KON.LAND_T * 0.5 ? 0.82 : 1.12;
        else b.head = Math.sin((u - KON.LAND_T) * 40) * 0.45 * (1 - (u - KON.LAND_T) / KON.SHAKE_T);
      } else {
        guardSpot(b, I);
        moveTo(b, I, b.fx, b.fz, 'guard');
      }
      break;
    }
    case 'trot': {
      const k = Math.min(1, b.t / Math.max(1e-3, b.dur));
      b.x = b.sx + (b.tx - b.sx) * k;
      b.z = b.sz + (b.tz - b.sz) * k;
      b.h = 0.02 * Math.abs(Math.sin(b.t * 14));
      face(b, b.tx, b.tz, dt, 14);
      b.clip = 'move';
      if (k >= 1) start(b, b.next || 'guard', b.nextSub);
      break;
    }
    case 'blink': {
      // Reduce Motion: a re-projection, out at A, in at B
      const half = KON.FADE;
      if (b.t < half) {
        b.fade = 1 - b.t / half;
      } else {
        b.x = b.tx;
        b.z = b.tz;
        b.fade = Math.min(1, (b.t - half) / half);
      }
      if (b.t >= half * 2) start(b, b.next || 'guard', b.nextSub);
      break;
    }
    case 'guard': {
      guardSpot(b, I);
      // step toward the side-step spot (a trot), facing the enemy
      const dx = b.fx - b.x;
      const dz = b.fz - b.z;
      const d = Math.hypot(dx, dz);
      const step = KON.TROT * dt;
      if (d > 0.01 && !I.calm) {
        const m = Math.min(d, step);
        b.x += (dx / d) * m;
        b.z += (dz / d) * m;
        b.clip = 'move';
      } else if (d > 0.01) {
        b.x = b.fx;
        b.z = b.fz;
      }
      if (I.enemy) {
        face(b, I.ex, I.ez, dt, I.calm ? 4 : 10);
        b.sy = 0.94; // crouched, ears up
        b.stepT -= dt;
        if (b.stepT <= 0 && !I.calm) {
          b.stepT = KON.STEP_MIN + rnd(b) * (KON.STEP_MAX - KON.STEP_MIN);
          const r = rnd(b);
          b.side = r < 0.34 ? -KON.STEP : r < 0.67 ? 0 : KON.STEP;
        }
      } else {
        b.side = 0;
        if (I.wave && b.quiet >= KON.PATROL_AFTER) start(b, 'patrol');
        else if (!I.wave && b.idle >= KON.PLAY_AFTER) startPlay(b, I);
      }
      break;
    }
    case 'patrol': {
      if (I.enemy) {
        start(b, 'guard');
        break;
      }
      if (!I.wave) {
        startPlay(b, I);
        break;
      }
      if (I.calm) {
        // calm: he sits and looks round instead of trotting
        b.head = Math.sin(b.clock * 0.8) * 0.6;
        break;
      }
      // away from his post (a pat, a nap by Ruri): trot back first
      if (Math.hypot(b.x - I.px, b.z - I.pz) > 0.5) {
        moveTo(b, I, I.px, I.pz, 'patrol');
        break;
      }
      b.sniffT -= dt;
      if (b.sniffT <= 0) {
        start(b, 'sniff');
        b.sniffT = KON.SNIFF_EVERY;
        break;
      }
      const w = KON.PATROL_W;
      const a = b.clock * w;
      const nx = I.px + Math.sin(a) * KON.PATROL_R;
      const nz = I.pz + Math.sin(a * 2) * KON.PATROL_R * 0.5;
      leash(b, I, nx, nz);
      face(b, b.fx, b.fz, dt, 10);
      b.x += (b.fx - b.x) * Math.min(1, dt * 8);
      b.z += (b.fz - b.z) * Math.min(1, dt * 8);
      b.clip = 'move';
      break;
    }
    case 'sniff': {
      b.headPitch = 0.45 * Math.min(1, b.t / 0.2);
      b.head = Math.sin(b.t * 9) * 0.12;
      if (I.enemy) start(b, 'guard');
      else if (b.t >= KON.SNIFF) start(b, 'patrol');
      break;
    }
    case 'play':
      stepPlay(b, I, dt);
      break;
    case 'rest': {
      b.sleep = true;
      b.sy = 0.72 + 0.03 * Math.sin(b.clock * 2.4);
      b.headPitch = 0.35;
      if (I.near || I.enemy) {
        start(b, 'wake');
        b.idle = 0;
      }
      break;
    }
    case 'wake': {
      const k = Math.min(1, b.t / KON.WAKE);
      b.sy = 0.72 + 0.28 * k + (k > 0.5 && k < 0.9 ? 0.06 : 0);
      b.h = I.calm ? 0 : 0.05 * Math.sin(Math.PI * k);
      if (k >= 1) {
        guardSpot(b, I);
        moveTo(b, I, b.fx, b.fz, 'guard');
      }
      break;
    }
    default:
      start(b, 'guard');
      break;
  }
  // nothing for a long while: off for a nap by Ruri
  if (b.idle >= KON.REST_AFTER && b.act !== 'rest' && b.act !== 'wake' && b.act !== 'trot' && b.act !== 'blink' && !I.enemy && !I.near) {
    moveTo(b, I, I.hx, I.hz, 'rest');
  }
  return b;
}

/** A kill by one of Ruri's bolts: a pounce on the spot (it does not count toward the 4th bolt). */
export function konPounce(b, tx, tz) {
  b.bolt = true;
  b.btx = tx;
  b.btz = tz;
  b.bbig = true;
}

function startPlay(b, I) {
  const list = I.calm ? CALM_PLAYS : PLAYS;
  start(b, 'play', 'sit');
  b.sitT = KON.SIT_MIN + rnd(b) * (KON.SIT_MAX - KON.SIT_MIN);
  b.next = list[Math.floor(rnd(b) * list.length) % list.length];
}

function stepPlay(b, I, dt) {
  // a wave starts or an enemy shows up: back to work (the trot to Ruri for a pat finishes first)
  if (I.enemy) {
    start(b, 'guard');
    return;
  }
  if (I.wave && b.sub !== 'pat') {
    start(b, 'patrol');
    return;
  }
  switch (b.sub) {
    case 'sit':
      if (b.t >= b.sitT) {
        const s = b.next;
        b.t = 0;
        b.sub = s;
        if (s === 'pat') {
          b.sub = 'patGo';
        } else if (s === 'chase') {
          const a = rnd(b) * Math.PI * 2;
          b.sx = b.x;
          b.sz = b.z;
          leash(b, I, b.x + Math.sin(a) * 0.35, b.z + Math.cos(a) * 0.35);
          b.tx = b.fx;
          b.tz = b.fz;
          b.yaw = Math.atan2(b.tx - b.x, b.tz - b.z);
        }
      }
      break;
    case 'tail': {
      // two spins after his tail
      const T = 1.2;
      b.yaw += (Math.PI * 4 / T) * dt;
      b.clip = 'move';
      if (b.t >= T) startPlay(b, I);
      break;
    }
    case 'roll': {
      const T = 0.8;
      b.roll = (b.t / T) * Math.PI * 2;
      b.h = 0.03 * Math.sin(Math.PI * Math.min(1, b.t / T));
      if (b.t >= T) startPlay(b, I);
      break;
    }
    case 'scratch': {
      const T = 0.9;
      b.h = 0.02 * Math.abs(Math.sin(b.t * 18));
      b.head = 0.35;
      b.headPitch = -0.15;
      if (b.t >= T) startPlay(b, I);
      break;
    }
    case 'chase': {
      // a pounce at nothing (a butterfly only he can see)
      const T = KON.POUNCE_T;
      const k = Math.min(1, b.t / T);
      b.x = b.sx + (b.tx - b.sx) * k;
      b.z = b.sz + (b.tz - b.sz) * k;
      b.h = 0.3 * 4 * k * (1 - k);
      b.pitch = -0.5 + k;
      b.clip = 'attack';
      if (k >= 1) startPlay(b, I);
      break;
    }
    case 'patGo':
      // trot to Ruri for a pat (the pat itself starts when he arrives)
      moveTo(b, I, I.hx, I.hz, 'play', 'pat');
      break;
    case 'pat': {
      b.heart = b.t < dt + 1e-6;
      b.sy = 0.96 + 0.04 * Math.sin(b.t * 6);
      b.headPitch = -0.2;
      if (b.t >= KON.PAT) {
        guardSpot(b, I);
        moveTo(b, I, b.fx, b.fz, 'guard');
      }
      break;
    }
    case 'yawn':
      b.headPitch = -0.35 * Math.sin(Math.PI * Math.min(1, b.t / 1.2));
      if (b.t >= 1.2) startPlay(b, I);
      break;
    case 'look':
      b.head = Math.sin(b.t * 1.5) * 0.6;
      if (b.t >= 2) startPlay(b, I);
      break;
    default:
      startPlay(b, I);
      break;
  }
}

/** @returns {{ busy: boolean, t: number, dur: number, tx: number, ty: number, tz: number, uid: number|null, k: number }} */
export function sortieState() {
  return { busy: false, t: 0, dur: 0, tx: 0, ty: 0, tz: 0, uid: null, k: 0 };
}

/**
 * Starts a sortie (Kaze's swoop / the doll's dash) at a target, unless one is already in flight: attacks that
 * come while it is busy are skipped. @returns {boolean} started
 */
export function startSortie(s, tx, ty, tz, dur, uid = null) {
  if (s.busy || !(dur > 0)) return false;
  s.busy = true;
  s.t = 0;
  s.dur = dur;
  s.tx = tx;
  s.ty = ty;
  s.tz = tz;
  s.uid = uid;
  s.k = 0;
  return true;
}

/** Follows a moving target while the sortie flies (the enemy walks on). */
export function retarget(s, tx, ty, tz) {
  if (!s.busy) return;
  s.tx = tx;
  s.ty = ty;
  s.tz = tz;
}

/**
 * One frame of a sortie from the home point (hx, hy, hz). Writes where the companion is into `out`
 * ({ x, y, z, out: true while heading to the target }); at home when idle. `reach` caps how far it goes,
 * `stop` keeps it that far short of the target, `lift` is the arc height.
 */
export function sortieStep(s, dt, hx, hy, hz, out, { reach = Infinity, stop = 0, lift = SWOOP_LIFT } = {}) {
  out.out = false;
  if (s.busy) {
    s.t += dt;
    s.k = s.t / s.dur;
    if (s.k >= 1) {
      s.busy = false;
      s.k = 0;
      s.uid = null;
    }
  }
  if (!s.busy) {
    out.x = hx;
    out.y = hy;
    out.z = hz;
    return out;
  }
  const k = s.k;
  const dx = s.tx - hx;
  const dz = s.tz - hz;
  const len = Math.hypot(dx, dz);
  const go = Math.max(0, Math.min(len - stop, reach));
  const f = len > 1e-6 ? go / len : 0;
  // out and back: u rises 0 → 1 by the middle of the sortie and falls back to 0, eased at both ends
  const u = Math.sin(Math.PI * k);
  out.x = hx + dx * f * u;
  out.z = hz + dz * f * u;
  out.y = hy + (s.ty - hy) * f * u + lift * 4 * u * (1 - u);
  out.out = k < 0.5;
  return out;
}

/**
 * Reconciles the actors with the girls on the board: makes one for every tower that has a companion and a
 * view, keeps the rest, drops the ones whose girl is gone (sold, removed, a new battle).
 * @param {Map<number, object>} actors uid -> actor (mutated)
 * @param {{ uid: number, unitId: string }[]} towers sim towers (read only)
 * @param {(unitId: string) => string|null} companionOf
 * @param {(t: object, cid: string) => object|null} make null = not yet (files loading, no view)
 * @param {(actor: object) => void} drop
 * @param {number} stamp a number unique to this call (frame counter)
 */
export function reconcile(actors, towers, companionOf, make, drop, stamp) {
  for (let i = 0; i < towers.length; i++) {
    const t = towers[i];
    const cid = companionOf(t.unitId);
    if (!cid) continue;
    let a = actors.get(t.uid);
    if (a && a.cid !== cid) {
      drop(a);
      actors.delete(t.uid);
      a = null;
    }
    if (!a) {
      a = make(t, cid);
      if (!a) continue;
      a.cid = cid;
      actors.set(t.uid, a);
    }
    a.stamp = stamp;
  }
  for (const [uid, a] of actors) {
    if (a.stamp !== stamp) {
      drop(a);
      actors.delete(uid);
    }
  }
}

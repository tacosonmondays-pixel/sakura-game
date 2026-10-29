// Attack shapes owner board (docs/specs/ATTACK_SHAPES.md §7.1): one animated mock-up per shape on a
// sample road with walking dots. Display-only tooling; nothing here is in the game build.
//
// The mock-ups step at the sim's 60 steps a second and use the sim's own direction table
// (src/sim/dirs.js: 240 directions, nearestDir, turnToward), integer step timers and the spec's tick
// rules, so what the owner approves is what the sim can do. Query: ?speed=0.5 for slow motion,
// ?shot=1 for the one-column phone layout used by the board image.

import { DIR_X, DIR_Y, dir, wrapDir, nearestDir, turnToward } from '../src/sim/dirs.js';
import { DET_MATH } from '../src/core/detMath.js';

const Q = new URLSearchParams(location.search);
const SPEED = Number(Q.get('speed') || 1);
if (Q.get('shot')) document.body.classList.add('shot');
if (Q.get('reel')) document.body.classList.add('reel');
const MANUAL = !!Q.get('manual');

const STEP = 1 / 60;
const N = 240; // table size
const TS = 44; // px per tile
const BW = 8; // board, tiles
const BH = 5;
const DPR = 2;
const GIRL = { x: 3, y: 2.5 };
const ROAD = [[-0.6, 1.35], [6.5, 1.35], [6.5, 3.65], [-0.6, 3.65]];
const WALK = 1.1 / 60; // tiles a step
const SPAWN_EVERY = 54;
const C = {
  grass: '#9fd77a', grass2: '#93cf6f', road: '#efe3cf', curb: '#c8b89f', ink: '#3b2a45', walker: '#5b3a5e',
  girl: '#ff8fbc', gold: '#f2b53a', petal: '#ffb3d1', fire: '#f08a3c', fire2: '#ffd36a', vine: '#3f8f45', leaf: '#6cc25a',
  ice: '#dff4ff', light: '#fff4b8', thread: '#e8506a', earth: '#9a6b3f',
};

// ---------------------------------------------------------------------------- road
const SEGS = [];
let ROAD_LEN = 0;
for (let i = 0; i + 1 < ROAD.length; i++) {
  const [ax, ay] = ROAD[i];
  const [bx, by] = ROAD[i + 1];
  const len = Math.abs(bx - ax) + Math.abs(by - ay); // axis-aligned legs
  SEGS.push({ ax, ay, bx, by, len, d0: ROAD_LEN, fx: (bx - ax) / len, fy: (by - ay) / len });
  ROAD_LEN += len;
}
function pointAt(d) {
  const dd = Math.max(0, Math.min(ROAD_LEN, d));
  for (const s of SEGS) if (dd <= s.d0 + s.len) return { x: s.ax + s.fx * (dd - s.d0), y: s.ay + s.fy * (dd - s.d0), fx: s.fx, fy: s.fy };
  const s = SEGS[SEGS.length - 1];
  return { x: s.bx, y: s.by, fx: s.fx, fy: s.fy };
}

// ---------------------------------------------------------------------------- walkers
function newState() {
  return { step: 0, uid: 1, walkers: [], fx: [] };
}
function stepWalkers(S) {
  if (S.step % SPAWN_EVERY === 0) S.walkers.push({ uid: S.uid++, dist: 0, slowT: 0, holdT: 0, burnT: 0, flash: 0, flashC: '#fff', hop: 0, held: false });
  for (const w of S.walkers) {
    if (w.holdT > 0) w.holdT--;
    else w.dist += WALK * (w.slowT > 0 ? 0.5 : 1);
    if (w.slowT > 0) w.slowT--;
    if (w.burnT > 0) w.burnT--;
    if (w.flash > 0) w.flash--;
    if (w.hop > 0) w.hop--;
    const p = pointAt(w.dist);
    w.x = p.x;
    w.y = p.y;
  }
  S.walkers = S.walkers.filter((w) => w.dist < ROAD_LEN);
  // walkers queue behind a held one instead of piling onto it (the list is in spawn order)
  for (let i = 1; i < S.walkers.length; i++) {
    const ahead = S.walkers[i - 1];
    const w = S.walkers[i];
    if (w.dist > ahead.dist - 0.4) {
      w.dist = ahead.dist - 0.4;
      const p = pointAt(w.dist);
      w.x = p.x;
      w.y = p.y;
    }
  }
}
const hit = (w, color = '#ffffff') => {
  w.flash = 8;
  w.flashC = color;
};
const d2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const inRange = (w, r) => d2(w.x, w.y, GIRL.x, GIRL.y) <= r * r;
/** Her target: the walker in range furthest along the road ("first"), ties by uid. */
function firstInRange(S, r) {
  let best = null;
  for (const w of S.walkers) if (inRange(w, r) && (!best || w.dist > best.dist)) best = w;
  return best;
}
const aimAt = (w) => nearestDir(w.x - GIRL.x, w.y - GIRL.y);

// straight shots (the sim's spawnStraight: a table direction, swept hits, pierce, a travel limit)
function shoot(S, k, { speed = 12, travel = 2.8, pierce = 2, r = 0.32, lead = false, kind = 'pin', from = GIRL } = {}) {
  S.shots ??= [];
  const i = wrapDir(k);
  S.shots.push({ x: from.x, y: from.y, vx: DIR_X[i] * speed * STEP, vy: DIR_Y[i] * speed * STEP, left: travel, pierce, r, hits: [], lead, kind, age: 0 });
}
function stepShots(S, onHit = (w) => hit(w)) {
  if (!S.shots) return;
  for (const p of S.shots) {
    p.x += p.vx;
    p.y += p.vy;
    p.age++;
    p.left -= Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    for (const w of S.walkers) {
      if (p.pierce <= 0 || p.hits.includes(w.uid)) continue;
      if (d2(p.x, p.y, w.x, w.y) <= p.r * p.r) {
        p.hits.push(w.uid);
        p.pierce--;
        onHit(w, p);
      }
    }
  }
  S.shots = S.shots.filter((p) => p.left > 0 && p.pierce > 0);
}

// ---------------------------------------------------------------------------- drawing
const px = (v) => v * TS;
function drawBoard(g, S) {
  g.fillStyle = C.grass;
  g.fillRect(0, 0, px(BW), px(BH));
  g.fillStyle = C.grass2;
  for (let i = 0; i < 26; i++) g.fillRect(px((i * 3.7) % BW), px((i * 1.9) % BH), 7, 4);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const road = () => {
    g.beginPath();
    ROAD.forEach(([x, y], i) => (i ? g.lineTo(px(x), px(y)) : g.moveTo(px(x), px(y))));
  };
  g.strokeStyle = C.curb;
  g.lineWidth = px(0.92);
  road();
  g.stroke();
  g.strokeStyle = C.road;
  g.lineWidth = px(0.78);
  road();
  g.stroke();
  // flow arrows
  g.fillStyle = '#d8c9b0';
  for (let d = 1.2; d < ROAD_LEN; d += 2.4) {
    const p = pointAt(d);
    g.save();
    g.translate(px(p.x), px(p.y));
    g.rotate(Math.atan2(p.fy, p.fx));
    g.beginPath();
    g.moveTo(5, 0);
    g.lineTo(-3, -4);
    g.lineTo(-3, 4);
    g.fill();
    g.restore();
  }
}
function drawRange(g, r) {
  g.save();
  g.setLineDash([5, 5]);
  g.strokeStyle = '#ffffffaa';
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(px(GIRL.x), px(GIRL.y), px(r), 0, Math.PI * 2);
  g.stroke();
  g.restore();
}
function drawGirl(g, facingK = null) {
  const x = px(GIRL.x);
  const y = px(GIRL.y);
  g.fillStyle = '#00000022';
  g.beginPath();
  g.ellipse(x, y + 9, 13, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = C.girl;
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, 11, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (facingK != null) {
    const [dx, dy] = dir(facingK);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(x + dx * 6, y + dy * 6, 3, 0, Math.PI * 2);
    g.fill();
  }
}
function drawWalkers(g, S) {
  for (const w of S.walkers) {
    const x = px(w.x);
    const y = px(w.y) - (w.hop > 0 ? Math.sin((w.hop / 12) * Math.PI) * 6 : 0);
    if (w.slowT > 0 || w.holdT > 0) {
      g.strokeStyle = C.leaf;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, 10, 0, Math.PI * 2);
      g.stroke();
    }
    if (w.burnT > 0) {
      g.fillStyle = '#f08a3c88';
      g.beginPath();
      g.arc(x, y - 3, 10 + Math.sin(w.burnT * 0.7) * 1.5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = w.flash > 0 ? w.flashC : C.walker;
    g.strokeStyle = w.flash > 0 ? C.walker : '#ffffffcc';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, 7, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}
function drawShots(g, S, style) {
  for (const p of S.shots || []) {
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
    const ux = p.vx / sp;
    const uy = p.vy / sp;
    style(g, p, px(p.x), px(p.y), ux, uy);
  }
}
function petalAt(g, x, y, ang, size, color) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, -size);
  g.quadraticCurveTo(size * 0.9, -size * 0.1, 0, size);
  g.quadraticCurveTo(-size * 0.9, -size * 0.1, 0, -size);
  g.fill();
  g.restore();
}
function streak(g, x, y, ux, uy, len, w, color) {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x - ux * len, y - uy * len);
  g.lineTo(x, y);
  g.stroke();
}

// ---------------------------------------------------------------------------- the ten shapes
const COS2 = []; // cos² of h table steps (spec §4.1), built once
for (let h = 0; h <= 60; h++) {
  const c = DET_MATH.cos((2 * Math.PI * h) / N);
  COS2.push(c * c);
}

const SHAPES = [
  {
    id: 'wheel', pose: (S) => S.shots?.length >= 10 && S.shots[0].age >= 7, n: 1, name: 'Blossom Wheel', batch: 1,
    does: 'Every attack, 12 shots leave her at once in a perfect wheel. One petal always points at her target and hits harder; the rest cut whatever stands round her.',
    suits: 'Momo (a coin wheel on Encore Toss), Miko (an ofuda wheel), Hotaru, Noa; Kinu already has one.',
    range: 2.8,
    step(S) {
      if (S.step % 75 === 0) {
        const tgt = firstInRange(S, 2.8);
        if (tgt) {
          const k0 = aimAt(tgt);
          for (let i = 0; i < 12; i++) shoot(S, k0 + Math.floor((i * N) / 12), { lead: i === 0, pierce: 2 });
          S.bloom = 14;
          S.face = k0;
        }
      }
      if (S.bloom > 0) S.bloom--;
      stepShots(S, (w, p) => hit(w, p.lead ? C.gold : '#ffffff'));
    },
    draw(g, S) {
      if (S.bloom > 0) for (let i = 0; i < 6; i++) petalAt(g, px(GIRL.x), px(GIRL.y), (i * Math.PI) / 3, 10 + (14 - S.bloom), '#ffd1e3aa');
      drawShots(g, S, (g2, p, x, y, ux, uy) => {
        streak(g2, x, y, ux, uy, 16, p.lead ? 5 : 3, p.lead ? '#f2b53a88' : '#ffb3d188');
        petalAt(g2, x, y, Math.atan2(uy, ux) + Math.PI / 2, p.lead ? 8 : 5.5, p.lead ? C.gold : C.petal);
      });
    },
  },
  {
    id: 'spiral', pose: (S) => (S.shots?.length ?? 0) >= 8, n: 2, name: 'Pinwheel Stream', batch: 1,
    does: 'A steady stream of small shots leaves her like a garden sprinkler, two arms turning round her. While an arm points at an enemy it turns slowly, so the stream lingers on crowds.',
    suits: 'Kage (Shuriken Cyclone on Storm of Steel), Fuu (Turbine Dancer), Ruri; Kinu has a spiral as an ability.',
    range: 2.8,
    step(S) {
      S.k ??= 0;
      const any = firstInRange(S, 2.8);
      if (any && S.step % 6 === 0) {
        for (let a = 0; a < 2; a++) shoot(S, S.k + a * (N / 2), { speed: 10, pierce: 1, r: 0.3 });
        // the lock: an arm with an enemy on its line advances 1 table step, otherwise 8
        let onLine = false;
        for (let a = 0; a < 2 && !onLine; a++) {
          const i = wrapDir(S.k + a * (N / 2));
          for (const w of S.walkers) {
            const ex = w.x - GIRL.x;
            const ey = w.y - GIRL.y;
            const dot = ex * DIR_X[i] + ey * DIR_Y[i];
            const cr = ex * DIR_Y[i] - ey * DIR_X[i];
            if (dot > 0 && dot * dot + cr * cr <= 2.8 * 2.8 && cr * cr <= 0.3 * 0.3) onLine = true;
          }
        }
        S.k = wrapDir(S.k + (onLine ? 1 : 8));
      }
      stepShots(S);
    },
    draw(g, S) {
      drawShots(g, S, (g2, p, x, y, ux, uy) => {
        streak(g2, x, y, ux, uy, 10, 3, '#cfd8ff99');
        g2.save();
        g2.translate(x, y);
        g2.rotate(p.age * 0.6);
        g2.fillStyle = '#6c7aa8';
        for (let i = 0; i < 4; i++) {
          g2.rotate(Math.PI / 2);
          g2.fillRect(-1.2, -6, 2.4, 6);
        }
        g2.restore();
      });
      S.face = S.k;
    },
  },
  {
    id: 'stream', pose: (S) => S.on && S.walkers.some((w) => w.burnT > 60), n: 3, name: 'Hearth Stream', batch: 2,
    does: 'She holds out her staff and a constant flame pours out in a cone, swinging smoothly after her target. Everything in the cone burns every 0.1 s and keeps burning after it leaves.',
    suits: 'Akane (Wildfire path), Midori (poison mist), Yuki (frost breath), Umeko or Sango (water jet), Kinu (steam).',
    range: 2.6,
    step(S) {
      const tgt = firstInRange(S, 2.6);
      if (tgt) {
        S.k = S.k == null ? aimAt(tgt) : turnToward(S.k, aimAt(tgt), 2);
        S.on = true;
        S.grace = 12;
      } else if (S.grace > 0) S.grace--;
      else S.on = false;
      if (S.on && S.step % 6 === 0) {
        const i = S.k;
        for (const w of S.walkers) {
          const ex = w.x - GIRL.x;
          const ey = w.y - GIRL.y;
          const dd = ex * ex + ey * ey;
          const dot = ex * DIR_X[i] + ey * DIR_Y[i];
          if (dd <= 2.9 * 2.9 && dot > 0 && dot * dot >= COS2[20] * dd) {
            hit(w, C.fire2);
            w.burnT = 90;
          }
        }
      }
    },
    draw(g, S) {
      if (!S.on) return;
      const x = px(GIRL.x);
      const y = px(GIRL.y);
      for (let layer = 0; layer < 3; layer++) {
        const h = 20 - layer * 6;
        const L = 2.6 - layer * 0.5 + Math.sin(S.step * 0.4 + layer) * 0.08;
        const [ax, ay] = dir(S.k - h);
        const [bx, by] = dir(S.k + h);
        g.fillStyle = ['#f08a3c99', '#ffb347aa', '#fff0a0cc'][layer];
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + px(ax * L * 0.7), y + px(ay * L * 0.7), x + px(ax * L), y + px(ay * L));
        const [mx, my] = dir(S.k);
        g.quadraticCurveTo(x + px(mx * (L + 0.25)), y + px(my * (L + 0.25)), x + px(bx * L), y + px(by * L));
        g.quadraticCurveTo(x + px(bx * L * 0.7), y + px(by * L * 0.7), x, y);
        g.fill();
      }
      S.face = S.k;
    },
  },
  {
    id: 'bramble', pose: (S) => (S.vines || []).some((v) => v.grown >= 2.3 && v.lashT > 0), n: 4, name: 'Bramble Road', batch: 3,
    does: 'A vine bursts out of the road and grows along it toward the enemies. Walkers on it slow down, the first one is wrapped and held, and the vine lashes everything on it every second.',
    suits: 'Chigusa (her vine tiers already describe this), Ena (cursed roots).',
    range: 2.6,
    step(S) {
      S.vines ??= [];
      if (S.step % 200 === 20) {
        // root at the road spot in range nearest the exit that has a walker within 2.4 tiles upstream
        let root = null;
        for (let d = 0; d <= ROAD_LEN; d += 0.5) {
          const p = pointAt(d);
          if (d2(p.x, p.y, GIRL.x, GIRL.y) > 2.6 * 2.6) continue;
          if (S.walkers.some((w) => w.dist <= d && w.dist >= d - 2.4)) root = d;
        }
        if (root != null) S.vines.push({ root, grown: 0, ttl: 260, lash: 60, held: null });
      }
      for (const v of S.vines) {
        v.ttl--;
        v.grown = v.ttl > 40 ? Math.min(2.4, v.grown + 3 * STEP) : Math.max(0, v.grown - 4 * STEP);
        const on = S.walkers.filter((w) => w.dist <= v.root && w.dist >= v.root - v.grown);
        for (const w of on) w.slowT = Math.max(w.slowT, 6);
        if (!v.held && on.length) {
          const lead = on.reduce((a, b) => (b.dist > a.dist ? b : a));
          if (!lead.held) {
            v.held = lead.uid;
            lead.held = true;
            lead.holdT = 90;
          }
        }
        if (--v.lash <= 0) {
          v.lash = 60;
          v.lashT = 10;
          for (const w of on) hit(w, '#c9f5b0');
        }
        if (v.lashT > 0) v.lashT--;
      }
      S.vines = S.vines.filter((v) => v.ttl > 0);
    },
    draw(g, S) {
      for (const v of S.vines || []) {
        if (v.grown <= 0.02) continue;
        const pts = [];
        for (let s = 0; s <= v.grown + 1e-6; s += 0.1) {
          const p = pointAt(v.root - s);
          const wob = Math.sin(s * 7 + (v.lashT || 0) * 0.8) * 0.12;
          pts.push([p.x - p.fy * wob, p.y + p.fx * wob, p]);
        }
        g.strokeStyle = v.lashT > 0 ? '#7ed36a' : C.vine;
        g.lineWidth = 7;
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(px(x), px(y)) : g.moveTo(px(x), px(y))));
        g.stroke();
        pts.forEach(([x, y], i) => {
          if (i % 3 !== 1) return;
          petalAt(g, px(x), px(y), i * 1.3, 6, C.leaf);
        });
        // soil burst at the root
        const r = pointAt(v.root);
        g.fillStyle = '#8a6a48';
        for (let i = 0; i < 5; i++) g.fillRect(px(r.x) - 8 + i * 4, px(r.y) - 3 + ((i * 7) % 5), 3, 3);
        const held = S.walkers.find((w) => w.uid === v.held && w.holdT > 0);
        if (held) {
          g.strokeStyle = C.vine;
          g.lineWidth = 2.5;
          for (let i = 0; i < 2; i++) {
            g.beginPath();
            g.ellipse(px(held.x), px(held.y), 10, 4, i ? 0.6 : -0.6, 0, Math.PI * 2);
            g.stroke();
          }
        }
      }
    },
  },
  {
    id: 'orbit', pose: (S) => S.walkers.some((w) => w.flash > 4), n: 5, name: 'Petal Halo', batch: 1,
    does: 'Six petals circle her in a steady ring. Any enemy that walks into the ring is cut as each petal passes; each petal keeps its own short memory so one enemy is not cut twice in a blink.',
    suits: 'Noa (Thousand Petal Ward), Iroha (glass shards), Hotaru (fireflies); Kinu already has scissors.',
    range: 1.5,
    step(S) {
      S.petalHits ??= Array.from({ length: 6 }, () => []);
      for (let j = 0; j < 6; j++) {
        const [dx, dy] = dir(S.step * 2 + Math.floor((j * N) / 6));
        const x = GIRL.x + dx * 1.15;
        const y = GIRL.y + dy * 1.15;
        const list = S.petalHits[j];
        for (const w of S.walkers) {
          if (d2(x, y, w.x, w.y) > 0.5 * 0.5) continue;
          const last = list.find((h) => h[0] === w.uid);
          if (last && S.step - last[1] < 15) continue;
          if (last) last[1] = S.step;
          else list.push([w.uid, S.step]);
          if (list.length > 32) list.shift();
          hit(w, '#ffd1e3');
        }
      }
    },
    draw(g, S) {
      g.strokeStyle = '#ffffff55';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(px(GIRL.x), px(GIRL.y), px(1.15), 0, Math.PI * 2);
      g.stroke();
      for (let j = 0; j < 6; j++) {
        for (let t = 2; t >= 0; t--) {
          const k = (S.step - t * 2) * 2 + Math.floor((j * N) / 6);
          const [dx, dy] = dir(k);
          petalAt(g, px(GIRL.x + dx * 1.15), px(GIRL.y + dy * 1.15), S.step * 0.15 + j, 8 - t * 1.5, t ? `rgba(255,179,209,${0.25 * (3 - t)})` : C.petal);
        }
      }
    },
  },
  {
    id: 'return', pose: (S) => S.fan?.leg === 1 && S.fan.left < 2, n: 6, name: 'Homecoming Throw', batch: 4,
    does: 'She throws a fan that flies out through the enemies, turns and flies back to her hand, cutting them again on the way home. A lined-up crowd is hit twice.',
    suits: 'Fuu (Returning Gale), Kage (Kusarigama), Hana (her falcon out and back), Rei (a blade wave).',
    range: 3,
    step(S) {
      S.cd = (S.cd ?? 0) - 1;
      if (!S.fan && S.cd <= 0) {
        const tgt = firstInRange(S, 3);
        if (tgt) {
          const k = aimAt(tgt);
          S.face = k;
          S.fan = { x: GIRL.x, y: GIRL.y, vx: DIR_X[k] * 7 * STEP, vy: DIR_Y[k] * 7 * STEP, left: 3, leg: 0, hits: [], age: 0 };
        }
      }
      const f = S.fan;
      if (!f) return;
      f.x += f.vx;
      f.y += f.vy;
      f.age++;
      f.left -= 7 * STEP;
      for (const w of S.walkers) {
        if (f.hits.includes(w.uid) || d2(f.x, f.y, w.x, w.y) > 0.4 * 0.4) continue;
        f.hits.push(w.uid);
        hit(w, f.leg ? '#c8f0ff' : '#ffffff');
      }
      if (f.left <= 0) {
        if (f.leg === 0) {
          f.leg = 1;
          f.vx = -f.vx; // exact negation, no trig
          f.vy = -f.vy;
          f.left = 3;
          f.hits = [];
        } else {
          S.fan = null;
          S.cd = 20;
          S.catch = 10;
        }
      }
      if (S.catch > 0) S.catch--;
    },
    draw(g, S) {
      const f = S.fan;
      if (S.catch > 0) {
        g.strokeStyle = `rgba(255,255,255,${S.catch / 10})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(px(GIRL.x), px(GIRL.y), 16 - S.catch, 0, Math.PI * 2);
        g.stroke();
      }
      if (!f) return;
      const sp = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
      streak(g, px(f.x), px(f.y), f.vx / sp, f.vy / sp, 26, 4, f.leg ? '#c8f0ff99' : '#ffffff99');
      g.save();
      g.translate(px(f.x), px(f.y));
      g.rotate(f.age * 0.5);
      g.fillStyle = '#e9d8a6';
      g.strokeStyle = '#4f9e88';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 11, -0.9, 0.9);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    },
  },
  {
    id: 'quake', pose: (S) => (S.rings || []).filter((r) => r.r > 0.6).length >= 2, n: 7, name: 'Ripple Quake', batch: 3,
    does: 'She strikes her drum and three rings of force roll out across the ground, one after another. Each ring hits every ground enemy it crosses once; the last one staggers them.',
    suits: 'Kanna (drum beats), Rei (Counter Form stamp), Suzu (bell toll), Hikari, Kaede\'s shockwave.',
    range: 2.6,
    step(S) {
      S.rings ??= [];
      if (S.step % 100 === 0 && firstInRange(S, 2.6)) {
        for (let i = 0; i < 3; i++) S.rings.push({ start: S.step + i * 12, r: 0, hit: [], last: i === 2 });
        S.stamp = 10;
      }
      if (S.stamp > 0) S.stamp--;
      for (const ring of S.rings) {
        if (S.step < ring.start) continue;
        const prev = ring.r;
        ring.r = Math.min(2.6, ring.r + 6 * STEP);
        for (const w of S.walkers) {
          const dd = d2(w.x, w.y, GIRL.x, GIRL.y);
          if (ring.hit.includes(w.uid) || dd <= prev * prev || dd > ring.r * ring.r) continue;
          ring.hit.push(w.uid);
          w.hop = 12;
          hit(w, ring.last ? '#ffe08a' : '#ffffff');
          if (ring.last) w.slowT = 40;
        }
      }
      S.rings = S.rings.filter((r) => r.r < 2.6);
    },
    draw(g, S) {
      for (const ring of S.rings || []) {
        if (S.step < ring.start || ring.r <= 0) continue;
        const a = 1 - ring.r / 2.6;
        g.strokeStyle = `rgba(154,107,63,${0.35 + 0.6 * a})`;
        g.lineWidth = ring.last ? 6 : 4;
        g.beginPath();
        g.arc(px(GIRL.x), px(GIRL.y), px(ring.r), 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = `rgba(90,60,30,${0.5 * a})`;
        g.lineWidth = 1.5;
        for (let i = 0; i < 12; i++) {
          const [dx, dy] = dir(i * 20 + 7);
          g.beginPath();
          g.moveTo(px(GIRL.x + dx * ring.r), px(GIRL.y + dy * ring.r));
          g.lineTo(px(GIRL.x + dx * (ring.r - 0.18)), px(GIRL.y + dy * (ring.r - 0.18)) + 3);
          g.stroke();
        }
      }
      if (S.stamp > 0) {
        g.fillStyle = `rgba(154,107,63,${S.stamp / 14})`;
        g.beginPath();
        g.ellipse(px(GIRL.x), px(GIRL.y) + 6, 20, 8, 0, 0, Math.PI * 2);
        g.fill();
      }
    },
  },
  {
    id: 'spikeline', pose: (S) => (S.rows || []).some((r) => S.step - r.born === 26), n: 8, name: 'Rising Spikes', batch: 3,
    does: 'She strikes the ground and a row of ice spikes erupts one after another along the road, racing up the lane toward the enemies behind her target; each stabs up, holds, then sinks.',
    suits: 'Yuki (Icicle Lance), Azami (Detonation Line), Chigusa (a thorn row), Sango (a coral row).',
    range: 2.8,
    step(S) {
      S.rows ??= [];
      if (S.step % 110 === 0) {
        const tgt = firstInRange(S, 2.8);
        if (tgt) S.rows.push({ born: S.step, from: tgt.dist + 0.5, hit: [] });
      }
      for (const row of S.rows) {
        for (let i = 0; i < 6; i++) {
          const age = S.step - row.born - i * 5;
          if (age !== 0) continue; // a spike hits on the step it rises
          const p = pointAt(row.from - i * 0.5);
          for (const w of S.walkers) {
            if (row.hit.includes(w.uid) || d2(p.x, p.y, w.x, w.y) > 0.45 * 0.45) continue;
            row.hit.push(w.uid);
            hit(w, C.ice);
            if (i === 0) w.holdT = Math.max(w.holdT, 24);
          }
        }
      }
      S.rows = S.rows.filter((r) => S.step - r.born < 6 * 5 + 40);
    },
    draw(g, S) {
      for (const row of S.rows || []) {
        for (let i = 0; i < 6; i++) {
          const age = S.step - row.born - i * 5;
          if (age < 0 || age > 40) continue;
          const p = pointAt(row.from - i * 0.5);
          const hgt = age < 4 ? (age / 4) * 1.2 : age < 28 ? 1 : 1 - (age - 28) / 12;
          const x = px(p.x);
          const y = px(p.y);
          g.fillStyle = '#00000022';
          g.beginPath();
          g.ellipse(x, y + 3, 9, 3.5, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = C.ice;
          g.strokeStyle = '#7fb8d8';
          g.lineWidth = 1.5;
          for (const [ox, s] of [[-4, 0.7], [4, 0.8], [0, 1]]) {
            g.beginPath();
            g.moveTo(x + ox - 4, y + 3);
            g.lineTo(x + ox, y + 3 - 22 * hgt * s);
            g.lineTo(x + ox + 4, y + 3);
            g.closePath();
            g.fill();
            g.stroke();
          }
        }
      }
    },
  },
  {
    id: 'sweep', pose: (S) => S.on && S.walkers.some((w) => w.flash > 4), n: 9, name: 'Searchlight Sweep', batch: 2,
    does: 'A long beam of light stays on and swings back and forth across the road, centred on the enemies. Everything it passes over is struck and revealed for a moment.',
    suits: 'Umeko (her Lighthouse path), Luna (beam hero), Kohaku (a corridor on her constant beam), Tenka (a sweeping rail).',
    range: 3.2,
    step(S) {
      S.hitAt ??= new Map();
      const tgt = firstInRange(S, 3.2);
      S.on = !!tgt || (S.on && S.step % 120 !== 0);
      if (tgt) S.c = S.c == null ? aimAt(tgt) : S.step % 4 === 0 ? turnToward(S.c, aimAt(tgt), 1) : S.c;
      if (S.c == null) return;
      // the swing: a triangle wave of ±24 table steps (±36°), one step a sim step
      const ph = S.step % 96;
      S.k = wrapDir(S.c + (ph < 48 ? ph - 24 : 72 - ph));
      if (S.on && S.step % 6 === 0) {
        const [dx, dy] = dir(S.k);
        for (const w of S.walkers) {
          const ex = w.x - GIRL.x;
          const ey = w.y - GIRL.y;
          let t = ex * dx + ey * dy;
          t = Math.max(0, Math.min(3.2, t));
          if (d2(w.x, w.y, GIRL.x + dx * t, GIRL.y + dy * t) > 0.3 * 0.3) continue;
          if (S.step - (S.hitAt.get(w.uid) ?? -99) < 30) continue;
          S.hitAt.set(w.uid, S.step);
          hit(w, C.light);
        }
      }
    },
    draw(g, S) {
      if (!S.on || S.k == null) return;
      const x = px(GIRL.x);
      const y = px(GIRL.y);
      const [ax, ay] = dir(S.k - 5);
      const [bx, by] = dir(S.k + 5);
      g.fillStyle = '#fff4b866';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + px(ax * 3.2), y + px(ay * 3.2));
      g.lineTo(x + px(bx * 3.2), y + px(by * 3.2));
      g.fill();
      const [dx, dy] = dir(S.k);
      g.strokeStyle = '#fffbe0';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + px(dx * 3.2), y + px(dy * 3.2));
      g.stroke();
      S.face = S.k;
    },
  },
  {
    id: 'tether', pose: (S) => S.tie?.pulse > 6 && S.tie.members.length >= 3, n: 10, name: 'Spirit Tether', batch: 4,
    does: 'Red threads snap from her target to the enemies near it. While tied, a hit on one makes the others flinch and take a share; when the threads expire they pull the group together.',
    suits: 'Ena (Red Threads, Threads of Destiny), Yoriko (puppet strings), Raika (a static link).',
    range: 3,
    step(S) {
      if (S.step % 150 === 0) {
        const tgt = firstInRange(S, 3);
        if (tgt) {
          const near = S.walkers.filter((w) => w !== tgt && d2(w.x, w.y, tgt.x, tgt.y) <= 1.6 * 1.6)
            .sort((a, b) => d2(a.x, a.y, tgt.x, tgt.y) - d2(b.x, b.y, tgt.x, tgt.y) || a.uid - b.uid).slice(0, 3);
          S.tie = { lead: tgt.uid, members: [tgt.uid, ...near.map((w) => w.uid)], left: 130, pulse: 0 };
        }
      }
      const tie = S.tie;
      if (tie) {
        if (tie.pulse > 0) tie.pulse--;
        if (S.step % 40 === 0) {
          const lead = S.walkers.find((w) => w.uid === tie.lead);
          if (lead) {
            hit(lead);
            S.bolt = { x: lead.x, y: lead.y, t: 8 };
            tie.pulse = 12;
            for (const w of S.walkers) if (w !== lead && tie.members.includes(w.uid)) hit(w, '#ffb0c0');
          }
        }
        if (--tie.left <= 0) {
          const lead = S.walkers.find((w) => w.uid === tie.lead);
          if (lead) for (const w of S.walkers) if (tie.members.includes(w.uid) && w !== lead) w.dist += (lead.dist - w.dist) * 0.35;
          S.tie = null;
        }
      }
      if (S.bolt && --S.bolt.t <= 0) S.bolt = null;
    },
    draw(g, S) {
      const tie = S.tie;
      if (tie) {
        const ms = tie.members.map((u) => S.walkers.find((w) => w.uid === u)).filter(Boolean);
        const lead = ms[0];
        if (lead && lead.uid === tie.lead) {
          for (const m of ms.slice(1)) {
            const mx = (px(lead.x) + px(m.x)) / 2;
            const my = (px(lead.y) + px(m.y)) / 2 + 10 * (tie.left / 130);
            g.strokeStyle = tie.pulse > 0 ? '#ff7f95' : C.thread;
            g.lineWidth = tie.pulse > 0 ? 3 : 2;
            g.beginPath();
            g.moveTo(px(lead.x), px(lead.y));
            g.quadraticCurveTo(mx, my, px(m.x), px(m.y));
            g.stroke();
          }
        }
      }
      if (S.bolt) {
        g.strokeStyle = `rgba(255,143,188,${S.bolt.t / 8})`;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(px(GIRL.x), px(GIRL.y));
        g.lineTo(px(S.bolt.x), px(S.bolt.y));
        g.stroke();
      }
    },
  },
];

// ---------------------------------------------------------------------------- cards and loop
const grid = document.getElementById('grid');
const BATCH = { 1: 'S1 Wheels', 2: 'S2 Held', 3: 'S3 Ground', 4: 'S4 Links' };
const cards = SHAPES.map((sh) => {
  const el = document.createElement('section');
  el.className = 'card';
  el.innerHTML = `<canvas width="${px(BW) * DPR}" height="${px(BH) * DPR}"></canvas>
    <div class="body"><div class="title"><span class="num">${sh.n}</span><b>${sh.name}</b><span class="batch b${sh.batch}">${BATCH[sh.batch]}</span></div>
    <p class="line"><em>Does:</em> ${sh.does}</p><p class="line"><em>Could suit:</em> ${sh.suits}</p></div>`;
  grid.appendChild(el);
  const g = el.querySelector('canvas').getContext('2d');
  g.scale(DPR, DPR);
  const S = newState();
  // warm the road up so every loop starts with walkers on it
  for (let i = 0; i < 60 * 9; i++) tick(sh, S);
  return { sh, g, S };
});

function tick(sh, S) {
  stepWalkers(S);
  sh.step(S);
  S.step++;
}

function draw({ sh, g, S }) {
  drawBoard(g, S);
  drawRange(g, sh.range);
  sh.draw(g, S);
  drawWalkers(g, S);
  drawGirl(g, S.face ?? null);
}

let acc = 0;
let last = performance.now();
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000) * SPEED;
  last = now;
  while (acc >= STEP) {
    for (const c of cards) tick(c.sh, c.S);
    acc -= STEP;
  }
  for (const c of cards) draw(c);
  requestAnimationFrame(frame);
}
cards.forEach(draw);
if (MANUAL) {
  // frame capture for the board video (tools: e2e or a node script): advance n sim steps, then draw
  window.__advance = (n) => {
    for (let i = 0; i < n; i++) for (const c of cards) tick(c.sh, c.S);
    cards.forEach(draw);
  };
  // the board image: each card stepped on until its shape is mid-action (at most 10 s)
  window.__pose = () => {
    for (const c of cards) for (let i = 0; i < 600 && !c.sh.pose(c.S); i++) tick(c.sh, c.S);
    cards.forEach(draw);
  };
} else requestAnimationFrame(frame);
window.__boardReady = true;

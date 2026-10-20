// Path runners (UNIT_GAPS P-5, ABILITIES §4 "runner"): something that travels ALONG the road,
// backwards from where it enters, hitting each enemy once. Today one user: Seiran's sky dragon
// (her Dragonflight ultimate). It moves by path distance with pointAt (the facing it reads was
// computed once when the path was built), so there is no free-flight trig; it hits only enemies
// on its own path (shared stretches, P-17, come later). Ends at the wave clear (Sim._checkWaveEnd).
//
// Uses these Sim members: pathData, grid, runners, _nextUid(), _emit(), _hit(e, tower, spec, scale).

import { pointAt, samplePath } from './path.js';
import { isEligible } from './combat.js';
import { RUNNER_HIT_RADIUS } from './constants.js';

const tmp = {};

/**
 * Where a runner enters: the road point nearest the aim (any path), else the exit end of the path
 * with the most living, visible enemies (ties: the lower path index). null when nothing to hit.
 * @returns {{ pathIndex: number, dist: number }|null}
 */
export function runnerEntry(sim, aim) {
  const paths = sim.pathData || [];
  if (aim) {
    let best = null;
    let bestD2 = Infinity;
    for (const path of paths) {
      for (const s of samplePath(path, 0.25)) {
        if (s.hidden) continue;
        const dx = s.x - aim.x;
        const dy = s.y - aim.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = { pathIndex: path.index, dist: s.d };
        }
      }
    }
    return best;
  }
  const count = paths.map(() => 0);
  for (const e of sim.enemies) if (!e.dead && !e.hidden && count[e.pathIndex] != null) count[e.pathIndex]++;
  let pick = -1;
  for (let i = 0; i < count.length; i++) if (count[i] > 0 && (pick < 0 || count[i] > count[pick])) pick = i;
  return pick < 0 ? null : { pathIndex: pick, dist: paths[pick].length };
}

/**
 * Launches a runner for a girl (a hero ultimate). `effect`: { length, time, segments, gap }; `spec`
 * the hit spec (its statuses skip bosses: they take the damage only).
 * @returns {object|null} the runner, or null when there is nowhere to run
 */
export function startRunner(sim, owner, effect, spec, aim = null) {
  const entry = runnerEntry(sim, aim);
  if (!entry) return null;
  const time = Math.max(0.1, effect.time || 3);
  const r = {
    uid: sim._nextUid(),
    ownerUid: owner.uid,
    pathIndex: entry.pathIndex,
    dist: entry.dist,
    speed: (effect.length || 10) / time,
    left: time,
    segments: Math.max(1, Math.floor(effect.segments || 6)),
    gap: effect.gap ?? 0.6,
    kind: effect.runner || 'dragon',
    // internals
    owner,
    spec,
    bossSpec: { ...spec, status: [] },
    hit: new Set(), // enemy uids already struck (membership only: order never matters)
    dead: false,
  };
  sim.runners.push(r);
  sim._emit('runner', { uid: r.uid, towerUid: owner.uid, kind: r.kind, pathIndex: r.pathIndex, dist: r.dist, segments: r.segments, gap: r.gap, time });
  return r;
}

/** Body point k of a runner (head k = 0, then toward where it came from), or null off the road. */
export function runnerSegment(sim, r, k, out = tmp) {
  const path = sim.pathData[r.pathIndex];
  if (!path) return null;
  const d = r.dist + k * r.gap;
  if (d < 0 || d > path.length) return null;
  return pointAt(path, d, out);
}

/** Moves every runner back along its road and strikes each enemy its body touches, once. */
export function updateRunners(sim, dt) {
  const list = sim.runners;
  const near = [];
  const r2 = RUNNER_HIT_RADIUS * RUNNER_HIT_RADIUS;
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (r.dead) continue;
    if (r.owner.removed) {
      r.dead = true;
      continue;
    }
    r.dist = Math.max(0, r.dist - r.speed * dt);
    r.left -= dt;
    for (let k = 0; k < r.segments; k++) {
      const p = runnerSegment(sim, r, k);
      if (!p) continue;
      const px = p.x;
      const py = p.y;
      near.length = 0;
      sim.grid.query(px, py, RUNNER_HIT_RADIUS + 0.5, near);
      for (let j = 0; j < near.length; j++) {
        const q = near[j];
        if (q.dead || q.hidden || q.pathIndex !== r.pathIndex || r.hit.has(q.uid)) continue;
        const dx = q.x - px;
        const dy = q.y - py;
        if (dx * dx + dy * dy > r2) continue;
        const spec = q.tier === 'boss' ? r.bossSpec : r.spec;
        if (!isEligible(q, spec)) continue;
        r.hit.add(q.uid);
        sim._hit(q, r.owner, spec, 1);
      }
    }
    if (r.left <= 1e-9 || r.dist <= 0) {
      r.dead = true;
      sim._emit('runnerEnd', { uid: r.uid, towerUid: r.ownerUid, hits: r.hit.size });
    }
  }
  let n = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].dead) list[n++] = list[i];
  list.length = n;
}

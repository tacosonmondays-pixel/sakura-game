// Path runners (UNIT_GAPS P-5, ABILITIES §4 "runner"): something that travels ALONG the road,
// backwards from where it enters, hitting each enemy once. Users: Seiran's sky dragon (her
// Dragonflight ultimate: all the way back to the road's START) and Marumi's Giant Strike ball (a
// fixed length, or to the spawn). It moves by path distance with pointAt (the facing it reads was
// computed once when the path was built), so there is no free-flight trig; it hits only enemies
// on its own path (shared stretches, P-17, come later). Ends at the wave clear (Sim._checkWaveEnd).
//
// Uses these Sim members: pathData, grid, runners, enemies, _nextUid(), _emit(), _hit(e, tower, spec, scale).

import { pointAt, samplePath } from './path.js';
import { isEligible } from './combat.js';
import { RUNNER_HIT_RADIUS } from './constants.js';

const tmp = {};
/** Two roads pass through the same road point (a shared stretch after a fork / before a join, or a junction) within this (tiles). */
const SAME_POINT = 0.3;

/**
 * Where a runner enters: the road point nearest the aim, else the exit end of the path with the most
 * living, visible enemies (ties: the lower path index). null when nothing to hit.
 * When the aim's road point is on a stretch several roads share, it takes the road with the most
 * living, visible enemies between there and its START (the branch it will fly; ABILITIES §5.2);
 * ties: the nearest road, then the lower path index.
 * @returns {{ pathIndex: number, dist: number }|null}
 */
export function runnerEntry(sim, aim) {
  const paths = sim.pathData || [];
  if (aim) {
    // each road's visible point nearest the aim
    const near = [];
    let best = null;
    for (const path of paths) {
      let n = null;
      for (const s of samplePath(path, 0.25)) {
        if (s.hidden) continue;
        const dx = s.x - aim.x;
        const dy = s.y - aim.y;
        const d2 = dx * dx + dy * dy;
        if (!n || d2 < n.d2) n = { pathIndex: path.index, dist: s.d, x: s.x, y: s.y, d2 };
      }
      if (!n) continue;
      near.push(n);
      if (!best || n.d2 < best.d2) best = n;
    }
    if (!best) return null;
    // the roads through that same point (always `best` itself): the one with the most enemies ahead
    let pick = null;
    let most = -1;
    for (const n of near) {
      const dx = n.x - best.x;
      const dy = n.y - best.y;
      if (dx * dx + dy * dy > SAME_POINT * SAME_POINT) continue;
      let c = 0;
      for (const e of sim.enemies) if (!e.dead && !e.hidden && e.pathIndex === n.pathIndex && e.dist <= n.dist) c++;
      // a tie keeps the nearer road, then the lower index (`near` is in path order)
      if (c > most || (c === most && n.d2 < pick.d2)) {
        most = c;
        pick = n;
      }
    }
    return { pathIndex: pick.pathIndex, dist: pick.dist };
  }
  const count = paths.map(() => 0);
  for (const e of sim.enemies) if (!e.dead && !e.hidden && count[e.pathIndex] != null) count[e.pathIndex]++;
  let pick = -1;
  for (let i = 0; i < count.length; i++) if (count[i] > 0 && (pick < 0 || count[i] > count[pick])) pick = i;
  return pick < 0 ? null : { pathIndex: pick, dist: paths[pick].length };
}

/**
 * Launches a runner for a girl (a hero ultimate, an ability). `spec`: the hit spec (its statuses skip
 * bosses: they take the damage only). `effect`:
 * - { length, time, segments, gap }: `length` tiles back along the road in `time` s (or until START);
 * - { toStart: true, time, minSpeed, segments, gap }: from the entry all the way back to the road's
 *   START, ending once the tail has passed it (the body slides off the road; runnerSegment is null
 *   past START). The flight takes at most `time` s and never goes slower than `minSpeed` tiles/s,
 *   so a long road is flown faster and a short aimed flight does not crawl.
 * @returns {object|null} the runner, or null when there is nowhere to run
 */
export function startRunner(sim, owner, effect, spec, aim = null, at = null) {
  // `at`: an entry the caller picked ({ pathIndex, dist }; Marumi's Giant Strike), else by aim / crowd
  const entry = at || runnerEntry(sim, aim);
  if (!entry) return null;
  const segments = Math.max(1, Math.floor(effect.segments || 6));
  const gap = effect.gap ?? 0.6;
  let time;
  let speed;
  let end = 0; // the head distance at which it ends
  if (effect.toStart) {
    end = -(segments - 1) * gap;
    const run = entry.dist - end;
    time = Math.max(0.1, Math.min(effect.time || 5, run / Math.max(0.1, effect.minSpeed || 3)));
    speed = run / time;
  } else {
    time = Math.max(0.1, effect.time || 3);
    speed = (effect.length || 10) / time;
  }
  const r = {
    uid: sim._nextUid(),
    ownerUid: owner.uid,
    pathIndex: entry.pathIndex,
    dist: entry.dist,
    speed,
    left: time,
    end,
    segments,
    gap,
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
    r.dist = Math.max(r.end, r.dist - r.speed * dt);
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
    if (r.left <= 1e-9 || r.dist <= r.end) {
      r.dead = true;
      sim._emit('runnerEnd', { uid: r.uid, towerUid: r.ownerUid, hits: r.hit.size });
    }
  }
  let n = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].dead) list[n++] = list[i];
  list.length = n;
}

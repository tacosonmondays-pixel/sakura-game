// Iroha's animations (display only): the mirror panel flips and glints for each relayed bolt (merged when bolts come
// faster than a flip lasts), leaves afterimages when it jumps, echoes while Mirror Shift runs, and her Shattered Glass
// splash hits scatter glass shards by tier (src/render/mirrorPanel.js, mirrorFx.js, attackFx/styles/iroha.js).
// Nothing here writes to the sim: the sim digest is identical with the FX on and off, and strict mode passes.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  FLIP, KICK_FLIP, KICK_MERGE, KICK_GLINT, KICK_FLASH, createPanelAnim, panelKick, panelPose, glintPhase, flashLevel,
  nearAngle, shotYaw, shardLevel, shardCount, kaleidoscope, SHARD_CAP, ghostCount, ghostAt,
} from '../../src/render/mirrorPanel.js';
import { MirrorFx, MAX_GHOSTS } from '../../src/render/mirrorFx.js';
import { RosterFx } from '../../src/render/rosterFx.js';
import { SHARDS_PER_FRAME } from '../../src/render/attackFx/styles/iroha.js';
import { harness, gallerySim, streamer, fakeAtlas } from './attackFxHarness.js';

const noop = () => {};

describe('mirror panel timing (pure)', () => {
  it('a shot starts a flip; shots inside minGap merge into it (no restart)', () => {
    const s = createPanelAnim();
    const k1 = panelKick(s, 1, 0.5, 0);
    expect(k1 & KICK_FLIP).toBeTruthy();
    expect(k1 & KICK_GLINT).toBeTruthy();
    expect(k1 & KICK_FLASH).toBeTruthy();
    const t0 = s.t0;
    const k2 = panelKick(s, 1 + FLIP.minGap / 2, 1.0, 0.4);
    expect(k2 & KICK_MERGE).toBeTruthy();
    expect(k2 & KICK_FLIP).toBeFalsy();
    expect(s.t0).toBe(t0);
    expect(s.to).toBeCloseTo(1.0);
    const k3 = panelKick(s, 1 + FLIP.minGap + 0.01, 2.0, 1.0);
    expect(k3 & KICK_FLIP).toBeTruthy();
  });

  it('a fast volley stays bounded: flips, glints and flashes are rate-limited', () => {
    const s = createPanelAnim();
    const T = 4;
    const rate = 30; // bolts a second, far faster than a flip lasts
    let flips = 0;
    let glints = 0;
    let flashes = 0;
    for (let i = 0; i < T * rate; i++) {
      const k = panelKick(s, i / rate, (i % 7) * 0.4, 0);
      if (k & KICK_FLIP) flips++;
      if (k & KICK_GLINT) glints++;
      if (k & KICK_FLASH) flashes++;
    }
    expect(flips).toBeLessThanOrEqual(Math.ceil(T / FLIP.minGap) + 1);
    expect(glints).toBeLessThanOrEqual(Math.ceil(T / FLIP.glintGap) + 1);
    expect(flashes).toBeLessThanOrEqual(Math.ceil(T / FLIP.flashGap) + 1);
    expect(flips).toBeGreaterThan(1);
    expect(s.merged).toBeGreaterThan(T * rate / 2);
  });

  it('Reduce motion: never a flip or a turn, but glints and flashes still play', () => {
    const s = createPanelAnim();
    const k = panelKick(s, 2, 1.2, 0, true);
    expect(k & (KICK_FLIP | KICK_MERGE)).toBe(0);
    expect(k & KICK_GLINT).toBeTruthy();
    expect(k & KICK_FLASH).toBeTruthy();
    const p = panelPose(s, 2.1, 0.1);
    expect(p.yaw).toBe(0.1);
    expect(p.tip).toBe(0);
    expect(glintPhase(s, 2.1)).toBeGreaterThan(0);
    expect(flashLevel(s, 2.05)).toBeGreaterThan(0);
  });

  it('pose: turns toward the shot (shortest way, tipping mid-turn), holds, then eases back to the idle sway', () => {
    const s = createPanelAnim();
    panelKick(s, 0, 3.0, -3.0); // the short way from -3 to 3 is through ±π
    expect(Math.abs(s.to - -3.0)).toBeLessThan(Math.PI);
    const mid = panelPose(s, FLIP.turn / 2, 0);
    expect(mid.tip).toBeGreaterThan(0);
    expect(mid.busy).toBe(true);
    const held = panelPose(s, FLIP.turn + FLIP.hold / 2, 0);
    expect(held.yaw).toBeCloseTo(s.to);
    expect(held.tip).toBe(0);
    const done = panelPose(s, FLIP.turn + FLIP.hold + FLIP.back + 0.01, 0.2);
    expect(done.busy).toBe(false);
    expect(done.yaw).toBe(0.2);
    expect(glintPhase(s, FLIP.glint + 0.01)).toBe(-1);
    expect(flashLevel(s, FLIP.flash + 0.01)).toBe(0);
  });

  it('angles and shot yaw', () => {
    expect(nearAngle(Math.PI * 2 + 0.1, 0)).toBeCloseTo(0.1);
    expect(nearAngle(-0.1, Math.PI * 4)).toBeCloseTo(Math.PI * 4 - 0.1);
    expect(shotYaw(0, 1)).toBeCloseTo(0); // the glass faces +z
    expect(shotYaw(1, 0)).toBeCloseTo(Math.PI / 2);
  });

  it('Shattered Glass: tier → shards, more each tier, fewer on low, a Kaleidoscope flare only at T5', () => {
    expect(shardLevel([5, 2, 0])).toBe(0);
    expect(shardLevel([0, 0, 1])).toBe(0); // Quick Polish: no splash yet
    expect(shardLevel([2, 0, 2])).toBe(1); // Splintered Glass
    expect(shardLevel([0, 0, 5])).toBe(4); // Kaleidoscope Burst
    const hi = [2, 3, 4, 5].map((t) => shardCount(t, 'high'));
    expect(hi).toEqual([3, 5, 7, 9]);
    for (const q of ['low', 'medium', 'high']) {
      let prev = 0;
      for (let t = 2; t <= 5; t++) {
        const n = shardCount(t, q);
        expect(n).toBeGreaterThanOrEqual(prev);
        expect(n).toBeLessThanOrEqual(SHARD_CAP);
        prev = n;
      }
      expect(shardCount(0, q)).toBe(0);
      expect(shardCount(1, q)).toBe(0);
    }
    expect(shardCount(5, 'low')).toBeLessThanOrEqual(3);
    expect(kaleidoscope(4, 'high')).toBe(0);
    expect(kaleidoscope(5, 'high')).toBe(2);
    expect(kaleidoscope(5, 'low')).toBe(1);
  });

  it('afterimages: a few along the jump (never on its ends); one that fades in place on Reduce motion', () => {
    expect(ghostCount('high')).toBeLessThanOrEqual(MAX_GHOSTS);
    expect(ghostCount('low')).toBeLessThan(ghostCount('high'));
    expect(ghostCount('high', true)).toBe(1);
    const n = ghostCount('high');
    let last = -1;
    for (let i = 0; i < n; i++) {
      const g = ghostAt(i, n, 0, 0, 10, 0);
      expect(g.x).toBeGreaterThan(0);
      expect(g.x).toBeLessThan(10);
      expect(g.x).toBeGreaterThan(last);
      last = g.x;
    }
    const r = ghostAt(2, n, 1, 2, 10, 0, true);
    expect([r.x, r.y, r.delay]).toEqual([1, 2, 0]);
  });
});

/** A RosterFx over a stand-in sim with one Iroha (her panel at ox, oy). */
function board({ reduceMotion = false, quality = 'high' } = {}) {
  const t = { uid: 7, unitId: 'iroha', x: 2, y: 2, ox: 5, oy: 2, origin: { x: 5, y: 2 }, tiers: [0, 0, 0], facing: 0, stats: { relay: { kind: 'mirror', reach: 3.7, both: true } } };
  const sim = { towers: [t], time: 0, getTower: (u) => (u === 7 ? t : null), runners: [], pathData: [] };
  const pushes = { n: 0 };
  const batch = { push: () => { pushes.n++; return true; } };
  const scene = new THREE.Scene();
  const fx = { ring: noop, puff: noop, flash: noop, spawn: noop, sparkle: noop, shards: noop, beam: noop, n: (x) => x };
  const roster = new RosterFx({
    sim, scene, fx, batches: { bbA: batch, bbN: batch, groundA: batch, groundN: batch }, atlas: fakeAtlas(),
    actors: { towers: new Map() }, quality, reduceMotion,
  });
  return { t, sim, roster, scene, pushes };
}

describe('mirror panel on the board (RosterFx + MirrorFx)', () => {
  it('a relayed bolt flips the panel toward the shot; it settles back', () => {
    const { roster } = board();
    roster.update(1 / 60);
    const mesh = roster.props.get(7).mesh;
    const idle = mesh.rotation.y;
    roster.mirrors.shot(7, -1, 0); // a shot going west
    for (let i = 0; i < 6; i++) roster.update(1 / 60);
    expect(Math.abs(mesh.rotation.y - idle)).toBeGreaterThan(0.5);
    for (let i = 0; i < 120; i++) roster.update(1 / 60);
    expect(Math.abs(mesh.rotation.y - idle)).toBeLessThan(0.3);
    expect(mesh.rotation.order).toBe('YXZ');
  });

  it('Reduce motion: the panel never turns for a shot (its glint still draws)', () => {
    const { roster, pushes } = board({ reduceMotion: true });
    roster.update(1 / 60);
    const mesh = roster.props.get(7).mesh;
    const before = pushes.n;
    roster.update(1 / 60);
    const idlePushes = pushes.n - before;
    const y0 = mesh.rotation.y;
    roster.mirrors.shot(7, -1, 0);
    const p0 = pushes.n;
    roster.update(1 / 60);
    expect(Math.abs(mesh.rotation.y - y0)).toBeLessThan(0.02); // only the slow idle sway
    expect(mesh.rotation.x).toBe(0);
    expect(pushes.n - p0).toBeGreaterThan(idlePushes);
  });

  it('a jump leaves pooled afterimages (capped), a shimmer, and dispose removes everything', () => {
    const { roster, t, scene } = board();
    roster.update(1 / 60);
    const before = roster.root.children.length;
    for (let k = 0; k < 6; k++) {
      t.ox = k % 2 ? 9 : 5;
      roster.handle({ type: 'relay', towerUid: 7, x: t.ox, y: 2, kind: 'mirror' });
    }
    roster.update(1 / 60);
    const pr = roster.mirrors.probe();
    expect(pr.pool).toBe(MAX_GHOSTS);
    expect(pr.liveGhosts).toBeLessThanOrEqual(MAX_GHOSTS);
    expect(pr.ghostsDropped).toBeGreaterThan(0);
    expect(roster.root.children.length).toBe(before + MAX_GHOSTS);
    // the panel jumps (snaps) instead of gliding
    expect(roster.props.get(7).x).toBe(t.ox);
    for (let i = 0; i < 60; i++) roster.update(1 / 60);
    expect(roster.mirrors.probe().liveGhosts).toBe(0);
    roster.dispose();
    expect(roster.root.children.length).toBe(0);
    expect(scene.children.includes(roster.root)).toBe(false);
  });

  it('low graphics: no ghost meshes are built (billboard afterimages instead)', () => {
    const { roster, t } = board({ quality: 'low' });
    roster.update(1 / 60);
    t.ox = 9;
    roster.handle({ type: 'relay', towerUid: 7, x: 9, y: 2, kind: 'mirror' });
    roster.update(1 / 60);
    const pr = roster.mirrors.probe();
    expect(pr.pool).toBe(0);
    expect(pr.liveGhosts).toBeGreaterThan(0);
  });

  it('Mirror Shift: the sim\'s ability event (or her ability state) opens the echo window, by the sim clock', () => {
    const { roster, t, sim } = board();
    expect(roster.mirrors.shifting(t)).toBe(false);
    roster.handle({ type: 'ability', towerUid: 7, id: 'iroha.mirrorShift', x: 5, y: 2 });
    expect(roster.mirrors.shifting(t)).toBe(true);
    sim.time += 8.1;
    expect(roster.mirrors.shifting(t)).toBe(false);
    t.abil = { id: 'iroha.mirrorShift', active: 30 };
    expect(roster.mirrors.shifting(t)).toBe(true);
  });
});

function digest(sim) {
  const r = (x) => Math.round(x * 1e9) / 1e9;
  return JSON.stringify({
    t: sim.time, cash: sim.cash, lives: sim.lives,
    towers: sim.towers.map((t) => [t.uid, t.cooldown, t.targetUid, t.ox, t.oy]),
    enemies: sim.enemies.map((e) => [e.uid, r(e.x), r(e.y), r(e.hp)]),
    projectiles: sim.projectiles.map((p) => [p.uid, r(p.x), r(p.y)]),
  });
}

/** Two Irohas over a real sim (Shattered Glass 5, Mirror Hall 3), with the panel layer attached as in the renderer. */
function run({ fx = true, strict = false, quality = 'high', reduceMotion = false, frames = 900 } = {}) {
  const sim = gallerySim(['iroha', 'iroha', 'iroha'], [[0, 2, 5], [3, 0, 2], [0, 0, 3]], 5);
  const feed = streamer(sim);
  const speed = 3;
  if (!fx) {
    for (let f = 0; f < frames; f++) {
      feed((1 / 60) * speed);
      sim.update((1 / 60) * speed);
      sim.drainEvents();
    }
    return { sim };
  }
  const h = harness(sim, { quality, strict, reduceMotion });
  const mfx = new MirrorFx({
    sim, fx: h.fx, batches: h.batches, atlas: fakeAtlas(), root: new THREE.Group(), quality, reduceMotion,
    geometry: () => new THREE.BoxGeometry(0.1, 0.1, 0.1),
  });
  const ctx = h.fxa.ctx;
  ctx.mirrors = mfx;
  let shards = 0;
  let maxFrame = 0;
  for (let f = 0; f < frames; f++) {
    feed((1 / 60) * speed);
    h.frame(1 / 60, speed);
    mfx.update(1 / 60);
    const b = ctx.irohaBudget;
    if (b && b.frame === ctx.frame) {
      shards += b.shards;
      maxFrame = Math.max(maxFrame, b.shards);
    }
  }
  return { sim, h, mfx, shards, maxFrame };
}

describe('Iroha over a real sim', { timeout: 180000 }, () => {
  it('is purely visual: identical sim digest with her FX on and off', () => {
    const a = run({ fx: true });
    const b = run({ fx: false });
    expect(digest(a.sim)).toBe(digest(b.sim));
  });

  it('every relayed bolt reaches the panel layer; flips stay rate-limited; Shattered Glass 5 scatters shards (capped per frame)', () => {
    const { mfx, shards, maxFrame, h } = run({ frames: 1200 });
    const st = mfx.probe();
    expect(st.shots).toBeGreaterThan(20);
    expect(st.flips).toBeGreaterThan(0);
    expect(st.flips).toBeLessThanOrEqual(st.shots);
    expect(st.panels).toBeGreaterThanOrEqual(2);
    expect(shards).toBeGreaterThan(10);
    expect(maxFrame).toBeLessThanOrEqual(SHARDS_PER_FRAME);
    expect(h.fxa.ctx.pool.count).toBeLessThanOrEqual(h.fxa.ctx.pool.cap);
  });

  it('strict mode (frozen sim views) and Reduce motion / low graphics run clean', () => {
    expect(() => run({ strict: true, frames: 500 })).not.toThrow();
    const rm = run({ reduceMotion: true, quality: 'low', frames: 600 });
    expect(rm.mfx.probe().flips).toBe(0);
    expect(rm.shards).toBeGreaterThan(0);
  });
});

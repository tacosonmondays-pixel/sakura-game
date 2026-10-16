// Owner bug (v0.1.34, "massive drone bug XD"): Chika 5-0-2 in the Sandbox at 3x, 50 elite
// Cinder Wyverns, and a giant drone (teal nose, white dome, orange ring) filled the screen. A drone
// whose launch hop ended on an early fixed sub-step of a frame stayed in LAUNCH for the frame's
// remaining sub-steps: its launch clock (-1 = done) kept counting, easeOutBack got a negative
// argument and its size became about -107 (drawn at about -145x) for good.
// Over a simulated run, every drone instance the attack-FX layer draws stays a drone: inside the
// map, at drone height, at drone size, for every flight mode, at 1x and 3x with uneven frames.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { harness, gallerySim } from './attackFxHarness.js';
import { FLIGHT_MODES } from '../../src/sim/constants.js';

// uneven frame times (a busy phone): 1 to 6 drone sub-steps per frame at 3x
const DTS = [1 / 60, 1 / 50, 1 / 40, 1 / 72, 1 / 24, 1 / 60, 1 / 33];
const m = new THREE.Matrix4();
const p = new THREE.Vector3();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();

function run(build, mode, speed, frames) {
  const sim = gallerySim(['chika'], [build], 3);
  const t = sim.towers[0];
  if (mode === 'hold') sim.setFlight(t.uid, 'hold', t.x + 2, t.y);
  else if (mode === 'patrol') sim.setFlight(t.uid, 'patrol', t.x - 2, t.y, t.x + 2, t.y);
  else if (mode === 'pursuit') sim.setFlight(t.uid, 'pursuit');
  const h = harness(sim, { quality: 'high' });
  const mesh = h.fxa.ctx.drones.mesh;
  const W = sim.map.width;
  const H = sim.map.height;
  const out = { frames: 0, launches: 0, maxDrones: 0, bad: [] };
  let n = 0;
  for (let f = 0; f < frames; f++) {
    if (sim.state !== 'wave') sim.startNextWave();
    // the owner's spawn: elite airborne wyverns, many at once
    if (f % 40 === 0 && sim.enemies.length < 50) for (let k = 0; k < 5; k++) sim.spawnEnemy('dragon_cinder', { dist: 0, pathIndex: 0, hpMul: 6 });
    h.frame(DTS[f % DTS.length], speed, (events) => {
      for (const ev of events) if (ev.type === 'attack' && ev.kind === 'build') out.launches++;
    });
    out.frames++;
    out.maxDrones = Math.max(out.maxDrones, mesh.count);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      const v = h.fxa.ctx.drones.list[i];
      const ok = [p.x, p.y, p.z, s.x, s.y, s.z].every(Number.isFinite)
        && s.x > 0.2 && s.x < 2.5 && s.y > 0.2 && s.y < 2.5 && s.z > 0.2 && s.z < 2.5
        && p.x > -1 && p.x < W + 1 && p.z > -1 && p.z < H + 1 && p.y > 0 && p.y < 3
        && v.grow > 0.2 && v.grow <= 1.1;
      if (!ok && n++ < 3) out.bad.push({ f, i, state: v?.state, grow: v?.grow, launchT: v?.launchT, pos: [p.x, p.y, p.z].map((x) => +x.toFixed(2)), scale: +s.y.toFixed(2) });
    }
  }
  out.badCount = n;
  return out;
}

describe('attack FX drones stay drone-sized, on the map, at drone height', { timeout: 180000 }, () => {
  for (const mode of FLIGHT_MODES) {
    it(`${mode}: Chika 5-0-2 and 2-0-5 at 1x and 3x with uneven frames, airborne elites`, () => {
      for (const build of [[5, 0, 2], [2, 0, 5]]) {
        for (const speed of [1, 3]) {
          const r = run(build, mode, speed, speed === 3 ? 1100 : 1600);
          // 5-0-2 builds 9 drones, 2-0-5 builds 3 (every one a launch hop)
          expect(r.launches, `${build} ${speed}x: drones were built (launch hops ran)`).toBeGreaterThanOrEqual(3);
          expect(r.badCount, `${build.join('-')} ${mode} ${speed}x: ${JSON.stringify(r.bad)}`).toBe(0);
        }
      }
    });
  }

  it('a launch hop that ends on an early sub-step of a frame leaves the drone at full size', () => {
    const sim = gallerySim(['chika'], [[5, 0, 2]], 3);
    const h = harness(sim, { quality: 'high' });
    const D = h.fxa.ctx.drones;
    // find the first launch, then run frames of 6 sub-steps each (0.1 game s at 1x)
    let v = null;
    for (let f = 0; f < 2000 && !v; f++) {
      h.frame(1 / 60, 1);
      v = D.list.find((x) => x.state === 'LAUNCH') || null;
    }
    expect(v, 'a drone launched').not.toBeNull();
    for (let f = 0; f < 10; f++) h.frame(0.1, 1);
    expect(v.launchT).toBe(-1);
    expect(v.grow).toBe(1);
    expect(v.state).not.toBe('LAUNCH');
  });
});

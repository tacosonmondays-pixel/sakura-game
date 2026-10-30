// The plain look of the ground attack shapes (attack shapes S3, docs/specs/ATTACK_SHAPES.md §5.4, §5.7, §5.8, A2 #9
// "ship plain, polish later"): drawn every frame from the sim's own road objects (t.vines, t.spikeRows, t.quakes),
// never from an event and never written to. Render only: no sim rng, no randomness at all.
//   - Bramble Road: a ribbon-free plain vine, a green band of ground discs along the road centreline over the vine's
//     grown stretch (pointAt on the render side), with small leaf stars on every other disc; it fades as it withers.
//   - Rising Spikes: each risen spike a pale ice base disc of the sim's spike radius and an ice star that pops up and
//     sinks over SPIKE_UP steps, with a small white core.
//   - Ripple Quake: each rolling ring an earth-coloured ground ring at the sim's radius (truth rule T5), fading toward
//     her range.
// Every body is alpha-blended (groundN); the only additive quads (groundA) are the spike cores, 0.2 tiles wide, under
// the flash guard's 0.3-tile line (docs/VFX.md), so none of this counts as a flash.
import { pointAt } from '../sim/path.js';
import { vineGrown } from '../sim/vines.js';
import { spikeAt, spikeRise } from '../sim/ground.js';
import { SPIKE_UP } from '../sim/constants.js';

/** Band discs this far apart along a vine (tiles), and their size (the road band's width). */
export const VINE_STEP_TILES = 0.3;
export const VINE_BAND = 0.5;
/** A spike row's additive core (tiles): under the flash guard's 0.3. */
export const SPIKE_CORE = 0.2;
const PT = {};

/**
 * Pushes the ground shapes of every girl into the ground batches (Actors.drawGround, every frame).
 * @param {object} sim the live Sim (read only)
 * @param {{ push: Function }} gN alpha ground batch
 * @param {{ push: Function }} gA additive ground batch
 * @param {object} R atlas regions (disc, star, ringThick)
 * @returns {number} quads pushed
 */
export function drawGroundShapes(sim, gN, gA, R) {
  let n = 0;
  for (const tw of sim.towers) {
    if (tw.vines?.length && tw.stats?.vine) n += drawVines(sim, tw, gN, R);
    if (tw.spikeRows?.length && tw.stats?.spike) n += drawSpikes(tw, gN, gA, R);
    if (tw.quakes?.length) n += drawQuakes(tw, gN, R);
    // attack shapes S5a: Bell Toll rings (src/sim/s5shapes.js), gold, the same plain ring
    if (tw.tolls?.length) n += drawTolls(tw, gN, R);
  }
  return n;
}

function drawVines(sim, tw, gN, R) {
  const v = tw.stats.vine;
  let n = 0;
  for (const vine of tw.vines) {
    const path = sim.pathData[vine.pathIndex];
    if (!path) continue;
    const grown = vineGrown(vine, v);
    if (!(grown > 0)) continue;
    // fade over the last 30 steps of its life
    const left = vine.life - vine.age;
    const a = left < 30 ? Math.max(0, left / 30) : 1;
    const count = Math.max(1, Math.floor(grown / VINE_STEP_TILES) + 1);
    for (let i = 0; i < count; i++) {
      const d = vine.root - Math.min(grown, i * VINE_STEP_TILES);
      const p = pointAt(path, d, PT);
      gN.push(p.x, 0.067, p.y, VINE_BAND, VINE_BAND, R.disc, 0.3, 0.55, 0.22, 0.8 * a, 0);
      n++;
      if (i % 2 === 1) {
        gN.push(p.x, 0.069, p.y, VINE_BAND * 0.6, VINE_BAND * 0.6, R.star, 0.45, 0.75, 0.3, 0.9 * a, vine.uid + i * 0.7);
        n++;
      }
    }
  }
  return n;
}

function drawSpikes(tw, gN, gA, R) {
  const sp = tw.stats.spike;
  const delay = Math.max(0, Math.round(sp.delay));
  const d = 2 * sp.r;
  let n = 0;
  for (const row of tw.spikeRows) {
    for (let i = 0; i < row.next; i++) {
      const up = row.age - spikeRise(row, i, delay);
      if (up < 0 || up > SPIKE_UP) continue;
      const [x, y] = spikeAt(row, i);
      // pops up over the first third, holds, sinks over the last third
      const f = up < SPIKE_UP / 3 ? up / (SPIKE_UP / 3) : up > (2 * SPIKE_UP) / 3 ? (SPIKE_UP - up) / (SPIKE_UP / 3) : 1;
      gN.push(x, 0.068, y, d, d, R.disc, 0.75, 0.9, 1, 0.55 * f, 0);
      gN.push(x, 0.07 + 0.2 * f, y, d * f, d * f, R.star, 0.85, 0.95, 1, 0.9 * f, row.uid + i);
      gA.push(x, 0.072, y, SPIKE_CORE * f, SPIKE_CORE * f, R.disc, 1, 1, 1, 0.6 * f, 0);
      n += 3;
    }
  }
  return n;
}

function drawTolls(tw, gN, R) {
  let n = 0;
  for (const q of tw.tolls) {
    if (!(q.r > 0)) continue;
    const a = q.max > 0 ? 0.8 * (1 - q.r / q.max) + 0.15 : 0.5;
    gN.push(q.x, 0.065, q.y, 2 * q.r, 2 * q.r, R.ringThick, 0.95, 0.78, 0.36, a, 0);
    n++;
  }
  return n;
}

function drawQuakes(tw, gN, R) {
  let n = 0;
  for (const q of tw.quakes) {
    if (q.wait > 0 || !(q.r > 0)) continue;
    const a = q.max > 0 ? 0.85 * (1 - q.r / q.max) + 0.1 : 0.5;
    gN.push(q.x, 0.064, q.y, 2 * q.r, 2 * q.r, R.ringThick, 0.62, 0.45, 0.28, a, 0);
    n++;
  }
  return n;
}

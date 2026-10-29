// Repeatable visual randomness (docs/VFX.md). Render code draws its random numbers (spark angles,
// puff sizes, lightning jitter, ambient timers) from a seeded stream instead of Math.random, so
// the same battle on the same frames gives the same picture: before/after screenshots compare
// like with like.
//
// Render-only: this never touches the sim's random numbers (sim.rng), and the sim never reads
// these. Each renderer system gets its own fork, so more effects in one system never shift the
// randomness of another.
//
//   const rand = createVisualRandom(visualSeed('battle', map.id));
//   const fxRand = rand.fork('fx');   // same label → same stream, however much the parent was used
//   fxRand();                         // [0, 1)

/** FNV-1a hash of the parts joined with '|' → uint32. */
export function visualSeed(...parts) {
  let h = 2166136261;
  const s = parts.map((p) => String(p ?? '')).join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A seeded random function (mulberry32): rand() → [0, 1), plus helpers.
 * @param {number|string} [seed]
 * @returns {(() => number) & { seed: number, range(lo: number, hi: number): number, int(lo: number, hi: number): number,
 *   signed(): number, pick<T>(arr: T[]): T, chance(p: number): boolean, fork(label: string): any, reseed(seed: number|string): void,
 *   state: number }}
 */
export function createVisualRandom(seed = 1) {
  let initial = toSeed(seed);
  let s = initial;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rand.range = (lo, hi) => lo + (hi - lo) * rand();
  rand.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * rand());
  /** [-0.5, 0.5) */
  rand.signed = () => rand() - 0.5;
  rand.pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];
  rand.chance = (p) => rand() < p;
  /** An independent stream for `label`: depends on this stream's seed only, not on its use. */
  rand.fork = (label) => createVisualRandom(visualSeed(initial, 'fork', label));
  /** Restarts this stream at a new seed (captures, tests). */
  rand.reseed = (next) => {
    initial = toSeed(next);
    s = initial;
  };
  Object.defineProperty(rand, 'seed', { get: () => initial, enumerable: true });
  Object.defineProperty(rand, 'state', {
    get: () => s,
    set: (v) => {
      s = v >>> 0;
    },
    enumerable: true,
  });
  return rand;
}

function toSeed(seed) {
  const n = typeof seed === 'string' ? visualSeed(seed) : Number(seed) >>> 0;
  return n || 1;
}

// Deterministic seeded RNG (mulberry32). Never use Math.random in sim/systems code
// that must be testable — accept an rng instead.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {number|string} seed
 * @returns {{ next(): number, int(min: number, max: number): number, range(min: number, max: number): number, pick<T>(arr: T[]): T, chance(p: number): boolean, weighted<T>(items: T[], weightFn: (t: T) => number): T, fork(label: string): any, seed: number }}
 */
export function createRng(seed = Date.now()) {
  let s = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 1;
  const initial = s;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    seed: initial,
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    range: (min, max) => next() * (max - min) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted(items, weightFn) {
      const total = items.reduce((a, t) => a + Math.max(0, weightFn(t)), 0);
      let r = next() * total;
      for (const t of items) {
        r -= Math.max(0, weightFn(t));
        if (r <= 0) return t;
      }
      return items[items.length - 1];
    },
    fork: (label) => createRng(hashString(`${initial}:${label}`)),
  };
  return rng;
}

// Set colours (docs/specs/GEAR_UPDATE.md §3.3): every set colour is ΔE ≥ 15 (CIE76) from every other set's, from the six
// club colours (src/data/clubs.js) and from LR's Nightglass navy (--plate, src/ui/styles/base.css).
import { describe, it, expect } from 'vitest';
import { GEAR_SETS } from '../../src/data/gearSets.js';
import { CLUBS } from '../../src/data/clubs.js';

const NIGHTGLASS = '#0e1930';
const lab = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; });
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const Y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const Z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
};
const deltaE = (a, b) => { const [x, y] = [lab(a), lab(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

describe('set colours', () => {
  it('are ΔE ≥ 15 apart from each other, every club colour and the Nightglass navy', () => {
    const sets = Object.entries(GEAR_SETS).map(([id, s]) => [id, s.color]);
    const others = [...Object.values(CLUBS).map((c) => [c.id, c.color]), ['nightglass', NIGHTGLASS]];
    for (const [id, c] of sets) {
      for (const [o, d] of [...others, ...sets.filter(([j]) => j !== id)]) expect(deltaE(c, d), `${id} vs ${o}`).toBeGreaterThanOrEqual(15);
    }
  });
});

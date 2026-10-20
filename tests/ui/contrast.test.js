// The contrast gate (docs/specs/UI_DIRECTION.md §8, gate 4): every token pair used as text passes, read from the real
// token values in base.css (tools/contrast.mjs prints the table).
import { describe, it, expect } from 'vitest';
import { contrastTable, ratio, composite } from '../../tools/contrast.mjs';

describe('contrast table', () => {
  it('the WCAG ratio matches known values', () => {
    expect(ratio(composite(['#000']), composite(['#fff']))).toBeCloseTo(21, 5);
    expect(ratio(composite(['#56647f']), composite(['#ffffff']))).toBeCloseTo(5.96, 2);
    expect(ratio(composite(['#6b7a99']), composite(['#ffffff']))).toBeCloseTo(4.31, 2); // the old --muted
  });
  it('every token pair used as text passes', () => {
    const bad = contrastTable().filter((r) => !r.ok).map((r) => `${r.text} on ${r.bg}: ${r.ratio}`);
    expect(bad).toEqual([]);
  });
});

// The contrast gate (docs/specs/UI_DIRECTION.md §8, gate 4): every token pair used as text passes, read from the real
// token values in base.css (tools/contrast.mjs prints the table).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastTable, ratio, composite, PAIRS } from '../../tools/contrast.mjs';

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
  it('[ui-ink] every UI v2 pair is measured: its tokens are all in base.css', () => {
    const missing = contrastTable().filter((r) => r.missing).map((r) => `${r.where}: ${r.missing.join(', ')}`);
    expect(missing).toEqual([]);
    expect(PAIRS.filter(([, , where]) => where.startsWith('v2:')).length).toBeGreaterThanOrEqual(30);
  });
  it('the "Medal owned" tag (results screen) uses the fill the table checks, at 4.5:1+ (M0-3)', () => {
    const css = readFileSync(new URL('../../src/ui/styles/battle.css', import.meta.url), 'utf8');
    const rule = css.match(/\.bt-medal-tag\.old\s*\{([^}]*)\}/)[1];
    expect(rule).toMatch(/color:\s*var\(--muted\)/);
    const fill = rule.match(/background:\s*(#[0-9a-f]{6})/i)[1].toLowerCase();
    expect(PAIRS.some(([fg, bg]) => fg === '--muted' && bg.length === 1 && bg[0] === fill)).toBe(true);
    const row = contrastTable().find((r) => r.text === '--muted' && r.bg === fill);
    expect(row.ok).toBe(true);
  });
});

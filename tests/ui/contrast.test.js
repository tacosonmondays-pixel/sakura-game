// The contrast gate (docs/specs/UI_DIRECTION.md §8, gate 4): every token pair used as text passes, read from the real
// token values in base.css (tools/contrast.mjs prints the table).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastTable, ratio, composite, PAIRS, tokens } from '../../tools/contrast.mjs';
import { CLUBS } from '../../src/data/clubs.js';

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
  it('Academy Club chips (.gu-club): every club\'s text ≥ 4.5:1 on its tinted fill at ≥ 12 px; Bell is no second yellow (M2 review look-4)', () => {
    const css = readFileSync(new URL('../../src/ui/styles/gear-ur.css', import.meta.url), 'utf8');
    const rule = css.match(/\.gu-club\s*\{([^}]*)\}/)[1];
    const rem = Number(rule.match(/font-size:\s*([\d.]+)rem/)[1]);
    expect(rem * 16).toBeGreaterThanOrEqual(12); // VAULT_BRIEF §2.4: the 12 px floor
    // color-mix(in srgb, var(--club) P%, INK) over color-mix(in srgb, var(--club) Q%, #fff): a gamma-space blend
    const [, p, ink] = rule.match(/[^-]color:\s*color-mix\(in srgb, var\(--club\) (\d+)%, (#[0-9a-f]{3,6})\)/i);
    const [, q, paper] = rule.match(/background:\s*color-mix\(in srgb, var\(--club\) (\d+)%, (#[0-9a-f]{3,6})\)/i);
    const rgb = (hex) => composite([hex]);
    const mix = (a, b, k) => rgb(a).map((v, i) => v * k + rgb(b)[i] * (1 - k));
    for (const c of Object.values(CLUBS)) {
      const r = ratio(mix(c.color, ink, p / 100), mix(c.color, paper, q / 100));
      expect(r, `${c.name} ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
    // one yellow per screen: Bell's hue sits outside the yellows (40°–70°), away from the --yellow primary
    const hue = (hex) => {
      const [r, g, b] = rgb(hex).map((v) => v / 255);
      const mx = Math.max(r, g, b);
      const d = mx - Math.min(r, g, b);
      if (!d) return 0;
      const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    expect(hue(tokens()['--yellow'])).toBeGreaterThanOrEqual(40);
    const bell = hue(CLUBS.bell.color);
    expect(bell < 40 || bell > 70, `Bell hue ${bell.toFixed(0)}°`).toBe(true);
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

// A boss never walks in hidden (Gate Arc Step 3 low, fixed in Step 4): on a landscape phone 3-10's Ashen Warden came
// out of the tear under the miniboss bar and the MINIBOSS banner. The bar turns see-through while its boss is under it
// (src/ui/battle/bossBar.js, every PEEK_EVERY s), and on a short screen the boss / phase banner is slimmer, lets the
// board show through and leaves within 1.4 s (src/ui/battle/feed.js, battle.css). General: every boss and miniboss.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { underRect, PEEK_EVERY } from '../../src/ui/battle/bossBar.js';

const src = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');

describe('the boss bar never hides its boss', () => {
  const bar = { left: 190, right: 655, top: 52, bottom: 90 };
  it('a point under the bar, or just beside or below it (a big body around its feet), counts; elsewhere not', () => {
    expect(underRect(bar, { clientX: 400, clientY: 70 })).toBe(true);
    expect(underRect(bar, { clientX: 170, clientY: 95 })).toBe(true); // the Warden at the tear, left of the bar's end
    expect(underRect(bar, { clientX: 400, clientY: 140 })).toBe(true); // feet below the bar, the body up under it
    expect(underRect(bar, { clientX: 400, clientY: 200 })).toBe(false);
    expect(underRect(bar, { clientX: 80, clientY: 70 })).toBe(false);
    expect(underRect(bar, { clientX: 400, clientY: 70, visible: false })).toBe(false);
    expect(underRect(null, { clientX: 1, clientY: 1 })).toBe(false);
    expect(underRect(bar, null)).toBe(false);
  });

  it('checks a few times a second, not every frame, and fades through a class (CSS)', () => {
    expect(PEEK_EVERY).toBeGreaterThanOrEqual(0.1);
    expect(PEEK_EVERY).toBeLessThanOrEqual(0.3);
    expect(src('ui/battle/bossBar.js')).toMatch(/classList\.toggle\('bt-boss-peek', under\)/);
    expect(src('ui/styles/battle.css')).toMatch(/\.bt-boss\.bt-boss-peek \{ opacity: 0\.2\d?; \}/);
  });

  it('on a short screen the boss and phase banners leave within 1.4 s and let the board show through', () => {
    expect(src('ui/battle/feed.js')).toMatch(/shortScreen\(\) && \(kind === 'boss' \|\| kind === 'phase'\)\) ms = Math\.min\(ms, 1400\)/);
    expect(src('ui/styles/battle.css')).toMatch(/@media \(max-height: 500px\) \{\n {2}\.bt-banner\.bt-banner-boss, \.bt-banner\.bt-banner-phase \{ opacity: 0\.86;/);
  });
});

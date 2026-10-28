// [ui-ink] The surface mode of every screen (src/ui/surfaceMode.js; notes/ui-v2/build/PLAN.md rule 2, the scope fence):
// every route has a mode except the battle, the title and the story scene, which get none, so no UI v2 rule reaches
// them and the battle keeps today's look.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { surfaceMode, applySurfaceMode, inkSurface, NO_MODE, NIGHT, MODE_CLASS } from '../../src/ui/surfaceMode.js';

/** The route names src/main.js registers. */
const ROUTES = [...readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8').matchAll(/registerRoute\('([\w-]+)'/g)].map((m) => m[1]);

/** A minimal element: classList + dataset. */
function fakeEl(initial = []) {
  const set = new Set(initial);
  return {
    dataset: {},
    classList: {
      toggle: (c, on) => { if (on) set.add(c); else set.delete(c); },
      contains: (c) => set.has(c),
    },
    has: (c) => set.has(c),
  };
}

describe('surfaceMode', () => {
  it('main.js registers the screens this test knows (the list is read from the file)', () => {
    expect(ROUTES.length).toBeGreaterThan(30);
    expect(ROUTES).toContain('lobby');
    expect(ROUTES).toContain('battle');
  });
  it('every route has a mode, except the battle, the title and the story scene', () => {
    for (const r of ROUTES) {
      const m = surfaceMode(r);
      if (NO_MODE.includes(r)) expect(m, r).toBeNull();
      else expect(['day', 'night'], r).toContain(m);
    }
    expect(NO_MODE).toEqual(['battle', 'title', 'scene']);
  });
  it('the home is night; menus, lists, hubs, the girl page, stage prep and the backpack are day', () => {
    expect(surfaceMode('lobby')).toBe('night');
    expect(NIGHT).toEqual(['lobby']);
    for (const r of ['students', 'student', 'formation', 'recruit', 'mall', 'commissions', 'mail', 'missions', 'multiplayer', 'settings', 'stage', 'backpack', 'rewards']) {
      expect(surfaceMode(r), r).toBe('day');
    }
  });
  it('an unknown or empty screen has no mode only when empty', () => {
    expect(surfaceMode('')).toBeNull();
    expect(surfaceMode(null)).toBeNull();
    expect(surfaceMode('some-new-screen')).toBe('day');
  });
  it('applySurfaceMode puts exactly one class on (or none) and data-surface', () => {
    const body = fakeEl();
    expect(applySurfaceMode(body, 'mall')).toBe('day');
    expect(body.has(MODE_CLASS.day) && !body.has(MODE_CLASS.night)).toBe(true);
    expect(body.dataset.surface).toBe('day');
    expect(inkSurface({ body })).toBe(true);
    applySurfaceMode(body, 'lobby');
    expect(body.has(MODE_CLASS.night) && !body.has(MODE_CLASS.day)).toBe(true);
    applySurfaceMode(body, 'battle');
    expect(body.has(MODE_CLASS.night) || body.has(MODE_CLASS.day)).toBe(false);
    expect(body.dataset.surface).toBeUndefined();
    expect(inkSurface({ body })).toBe(false);
  });
  it('no DOM (node): nothing happens and no surface is reported', () => {
    expect(applySurfaceMode(undefined, 'mall')).toBe('day');
    expect(inkSurface(undefined)).toBe(false);
  });
});

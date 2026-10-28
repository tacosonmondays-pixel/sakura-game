// Gate Arc S3a · how a Brigade unit leaves the board (src/render/fallStyles.js, fx sparkFall /
// breakdown, STEP3_BUILD_PLAN decision 9): the Gnat (a construct-family def in Step 3, keyed by its
// id) breaks apart in amber sparks, a trooper falls and fades, the heavier machines break down; none
// of them gets the homeward sparkle, nothing outlives a second (nothing stays on the road), and
// every shipped monster keeps the shipped poof and sparkle.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FxSystem } from '../../src/render/fx.js';
import { fallStyleOf, homeward, playFall, FALL_STYLES } from '../../src/render/fallStyles.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { FIXTURE_GNAT } from '../../previews/oldTownMaps.js';

/** An FxSystem on a stand-in atlas: spawned particles are recorded (uv = the region's name). */
function fxStub() {
  const regions = new Proxy({}, { get: (_, k) => k });
  const fx = new FxSystem({ atlas: { regions }, batches: {}, camera: null });
  fx.setQuality('high');
  let s = 7;
  fx.rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return fx;
}

const STAR = 'star';

describe('fall styles', () => {
  it('the Gnat (by id, on the construct family) sparks, the Brigade\'s troopers fade, its heavy machines break down; monsters keep the sparkle', () => {
    expect(fallStyleOf(FIXTURE_GNAT)).toBe('sparkFall');
    expect(FIXTURE_GNAT.family).toBe('construct');
    expect(fallStyleOf({ id: 'brigade_gnat_elite', family: 'construct' })).toBe('sparkFall');
    expect(fallStyleOf({ id: 'brigade_trooper', family: 'brigade' })).toBe('fade');
    expect(fallStyleOf({ id: 'some_unit', family: 'brigade' })).toBe('fade');
    for (const id of ['brigade_tortoise', 'brigade_badger', 'brigade_strider', 'brigade_hammer']) expect(fallStyleOf({ id })).toBe('breakdown');
    expect(fallStyleOf({ id: 'x', fall: 'breakdown' })).toBe('breakdown');
    expect(fallStyleOf({ id: 'x', fall: 'nonsense' })).toBe('sparkle');
    expect(fallStyleOf(null)).toBe('sparkle');
    // every shipped enemy (the construct family included) keeps the shipped death
    for (const e of ENEMIES) expect(fallStyleOf(e), e.id).toBe('sparkle');
    expect(FALL_STYLES.filter(homeward)).toEqual(['sparkle']);
  });

  it('no homeward sparkle for any Brigade style; the shipped death keeps it', () => {
    for (const style of FALL_STYLES) {
      const fx = fxStub();
      playFall(fx, style, { x: 3, y: 0, z: 4, size: 0.6, color: '#2b3a5c' });
      const stars = fx.parts.filter((p) => p.uv === STAR).length;
      if (style === 'sparkle') expect(stars, style).toBeGreaterThan(0);
      else expect(stars, style).toBe(0);
      expect(fx.parts.length, style).toBeGreaterThan(0);
    }
  });

  it('the Gnat\'s spark fall: amber sparks (the sparkle\'s), falling; nothing left once a second has passed', () => {
    const fx = fxStub();
    playFall(fx, 'sparkFall', { x: 3, y: 0, z: 4, size: 0.55 });
    const sparks = fx.parts.filter((p) => p.uv === 'spark');
    expect(sparks.length).toBeGreaterThan(5);
    for (const p of sparks) {
      expect(p.g).toBeLessThan(0);
      // amber: red full, green well up, blue low (linear values)
      expect(p.r).toBeGreaterThan(0.9);
      expect(p.gc).toBeGreaterThan(0.25);
      expect(p.bc).toBeLessThan(p.gc);
    }
    for (const style of ['fade', 'sparkFall', 'breakdown']) {
      const f = fxStub();
      playFall(f, style, { x: 3, y: 0, z: 4, size: 1, color: '#2b3a5c' });
      expect(Math.max(...f.parts.map((p) => p.life)), style).toBeLessThanOrEqual(1);
    }
  });

  it('the battle renderer plays the def\'s fall style on a death (no more fixed sparkle)', () => {
    const src = readFileSync(new URL('../../src/render/BattleRenderer.js', import.meta.url), 'utf8');
    expect(src).toMatch(/playFall\(fx, fallStyleOf\(enemyDef\(ev\.id\)\), p\)/);
    expect(src).not.toMatch(/fx\.death\(p\.x, p\.y, p\.z, p\.size, p\.color\)/);
  });

  it('nothing in the fall FX names a wound or a body', () => {
    const src = readFileSync(new URL('../../src/render/fallStyles.js', import.meta.url), 'utf8');
    expect(src.toLowerCase()).not.toMatch(/\b(blood|gore|corpse|bleed)/);
  });
});

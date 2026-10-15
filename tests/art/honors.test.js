// Honor Ribbon art (src/art/honors.js): every ribbon row has art and every art entry a row, every emblem exists, and
// gradient ids are unique per drawn instance (two copies on one page never hide each other).
import { describe, it, expect } from 'vitest';
import { HONOR_ART, EMBLEMS, SILHOUETTES, honorSVG, honorMasks, honorSizeTier, fxLayers } from '../../src/art/honors.js';
import { ACHIEVEMENTS } from '../../src/data/achievements.js';
import { HONOR_RIBBONS } from '../../src/data/honors.js';

const rows = ACHIEVEMENTS.filter((a) => a.honor);
const ids = (svg) => [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);

describe('honor art', () => {
  it('HONOR_ART has exactly one colourway per ribbon row, with 7–8 colours', () => {
    expect(Object.keys(HONOR_ART).sort()).toEqual(rows.map((a) => a.id).sort());
    for (const [id, art] of Object.entries(HONOR_ART)) {
      expect(art.c.length, id).toBeGreaterThanOrEqual(7);
      for (const col of art.c) expect(col).toMatch(/^#[0-9a-f]{6}$/i);
    }
    for (const a of rows.filter((x) => x.honor.cls === 'special')) expect(HONOR_ART[a.id].aura, a.id).toMatch(/^#/);
  });

  it('every emblem used exists, and every class has a silhouette', () => {
    for (const a of rows) expect(typeof EMBLEMS[a.honor.emblem], a.id).toBe('function');
    for (const c of ['plain', 'shiny', 'special']) expect(SILHOUETTES[c].tails).toBeTruthy();
    expect(SILHOUETTES.special.aura).toBeTruthy();
    expect(SILHOUETTES.plain.inner).toBeNull();
  });

  it('honorSVG ids are unique per instance', () => {
    const a = ids(honorSVG('a_ur_1'));
    const b = ids(honorSVG('a_ur_1'));
    expect(a.length).toBeGreaterThan(1);
    for (const id of a) expect(b).not.toContain(id);
    expect(a.every((id) => /^hr27-\d+[tdf]$/.test(id))).toBe(true);
  });

  it('every ribbon draws as a well-formed SVG; locked and secret are grey (secret shows "?")', () => {
    for (const h of HONOR_RIBBONS) {
      const svg = honorSVG(h.id);
      expect(svg.startsWith('<svg') && svg.endsWith('</svg>')).toBe(true);
      expect(svg).not.toContain('undefined');
    }
    expect(honorSVG('a_chapter_1', { locked: true })).toContain('#d7e0ec');
    expect(honorSVG('a_first_petals', { secret: true })).toContain('>?</text>');
    expect(honorSVG('a_unknown')).toContain('<svg'); // an unknown id draws a neutral ribbon
  });

  it('masks for every class, size tiers and the effect layers per size', () => {
    const m = honorMasks();
    for (const k of ['--rbm-plain', '--rbm-shiny', '--rbm-special', '--rbm-ring-special', '--rbm-disc-special', '--rbm-rosette', '--rbm-aura-ring']) expect(m[k]).toMatch(/^url\("data:image\/svg\+xml,/);
    expect([honorSizeTier(40), honorSizeTier(64), honorSizeTier(160)]).toEqual(['s', 'm', 'l']);
    const fx = HONOR_RIBBONS.filter((h) => h.effect).map((h) => h.effect);
    for (const f of fx) {
      expect(fxLayers(f, 's').length, f).toBeGreaterThan(0);
      // more layers as the ribbon grows, never fewer
      expect(fxLayers(f, 'l').length, f).toBeGreaterThanOrEqual(fxLayers(f, 'm').length);
    }
    expect(fxLayers('sakura', 'l').match(/<i><\/i>/g)).toHaveLength(8 + 2);
  });

  it('never SMIL or animated SVG attributes', () => {
    for (const h of HONOR_RIBBONS) expect(/<animate|<set |animateTransform/.test(honorSVG(h.id))).toBe(false);
  });
});

// [ui-ink] V3 (UI v2 menus M3): the girl tile frames every girl's card art from her -card face anchor so every eye line
// sits at one height (src/ui/components.js tileFrame), never leaving a gap at an edge; a girl not met yet says how she
// joins in a few words; each role family has a line glyph.
import { describe, it, expect } from 'vitest';
import { tileFrame, TILE_EYE, joinRule, ROLE_GLYPH, GIRL_STEP } from '../../src/ui/components.js';
import { faceAnchor } from '../../src/ui/faceAnchors.js';
import { UNITS } from '../../src/data/units.js';
import { ROLES, ROLE_CATEGORIES } from '../../src/data/types.js';
import { hasLineGlyph } from '../../src/ui/lineGlyphs.js';

const K = (500 / 300) / 1.3;

describe('girl tile framing (tileFrame)', () => {
  it('every girl: a zoom of 1.22 to 1.5, no gap at the top or the bottom, the shift across inside the zoom\'s slack', () => {
    for (const u of UNITS) {
      const f = tileFrame(u.id);
      expect(f.s, u.id).toBeGreaterThanOrEqual(1.22);
      expect(f.s, u.id).toBeLessThanOrEqual(1.5);
      expect(f.y, u.id).toBeLessThanOrEqual(0);
      // the art's bottom stays at or below the tile's bottom
      expect(f.y / 100 + f.s * K, u.id).toBeGreaterThanOrEqual(1 - 1e-3);
      expect(Math.abs(f.x), u.id).toBeLessThanOrEqual(((f.s - 1) / 2) * 100 + 0.05);
    }
  });
  it('the eye line lands at one height for every girl whose drawing allows it (the rest sit higher, never lower)', () => {
    let atLine = 0;
    for (const u of UNITS) {
      const f = tileFrame(u.id);
      const eye = f.y / 100 + f.s * faceAnchor(u.id, 'card').eye * K;
      expect(eye, u.id).toBeLessThanOrEqual(TILE_EYE + 0.002);
      if (Math.abs(eye - TILE_EYE) < 0.002) atLine++;
    }
    expect(atLine).toBeGreaterThanOrEqual(UNITS.length - 4);
  });
  it('her chin stays above the caption band (the bottom fifth of the tile)', () => {
    for (const u of UNITS) {
      const f = tileFrame(u.id);
      const chin = f.y / 100 + f.s * faceAnchor(u.id, 'card').chin * K;
      expect(chin, u.id).toBeLessThan(0.8);
    }
  });
});

describe('girl tile words and marks', () => {
  it('a girl not met yet: "Clear 6-5", "Recruit" or "Starter", short enough for a tile', () => {
    for (const u of UNITS) {
      const r = joinRule(u);
      expect(r, u.id).toMatch(/^(Clear \d+-\d+|Recruit|Starter)$/);
      expect(r.length, u.id).toBeLessThanOrEqual(10);
    }
  });
  it('every role family has a line glyph; every girl\'s role is in a family', () => {
    for (const fam of Object.keys(ROLE_CATEGORIES)) expect(hasLineGlyph(ROLE_GLYPH[fam]), fam).toBe(true);
    for (const u of UNITS) expect(ROLES[u.role]?.category, u.id).toBeTruthy();
  });
  it('the frame ladder: R flat, SR tinted, SSR Glow, UR rainbow, LR its own (Nightglass)', () => {
    expect(GIRL_STEP).toEqual({ R: '', SR: 'sr', SSR: 'ssr', UR: 'ur', LR: 'lr' });
  });
});

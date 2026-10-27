// [ui-ink] UI v2 V2: where the home puts its host (src/ui/lobby/hostPlace.js) and Marumi's living scene
// (src/ui/lobby/live/marumi.js, C5). With the mock-up's control boxes at 844x390 and 1280x720 (12.1): every girl's
// eye line lands on the home's eye line (or at most 12 % lower), her face where the face spot is (or at most 4 % of
// the width aside), her art (by its measured extents) 8 px clear of every control, never below 0.8 of her size; Marumi's
// living figure the same at the largest scale that passes (C5's floor 0.8 of the cover fit).
import { describe, it, expect } from 'vitest';
import { UNITS } from '../../src/data/units.js';
import { FACE_ANCHORS, CUT_EXTENTS } from '../../src/ui/faceAnchors.js';
import { placeHost, homeTarget, freeShift, bandsOf, placeScene, faceBox } from '../../src/ui/lobby/hostPlace.js';
import { placeMarumi, ANCHOR as M_ANCHOR, EXTENTS as M_EXTENTS, FRAME } from '../../src/ui/lobby/live/marumi.js';
import { PORTRAIT_DATA } from '../../src/art/portraits.js';

/** The home's control boxes as the mock-up draws them (12.1): top bar pieces, rail, objective + news, chapter, tools. */
const BOXES = {
  '844x390': [[16, 10, 150, 32], [374, 10, 268, 32], [690, 10, 138, 32], [16, 50, 184, 308], [556, 50, 272, 96], [556, 200, 272, 100], [740, 322, 88, 44]],
  '1280x720': [[24, 16, 200, 48], [694, 16, 364, 48], [1090, 16, 166, 48], [24, 104, 276, 336], [900, 84, 356, 120], [910, 372, 346, 148], [1160, 648, 96, 48]],
};
const boxes = (vp) => BOXES[vp].map(([x, y, w, h]) => ({ x, y, w, h }));
// (to a thousandth of a px: a slide lands exactly on the 8 px line)
const clearOf = (bands, bx, m) => bands.every((b) => bx.every((u) => b.y1 <= u.y - m + 1e-3 || b.y0 >= u.y + u.h + m - 1e-3 || b.x1 <= u.x - m + 1e-3 || b.x0 >= u.x + u.w + m - 1e-3));

describe('freeShift', () => {
  it('no clash: no slide; a clash: the smallest slide that clears, within the allowance', () => {
    const box = [{ x: 100, y: 0, w: 50, h: 100 }];
    expect(freeShift([{ x0: 0, x1: 80, y0: 0, y1: 50 }], box, 8, 30)).toBe(0);
    expect(freeShift([{ x0: 0, x1: 95, y0: 0, y1: 50 }], box, 8, 30)).toBe(-3);
    expect(freeShift([{ x0: 0, x1: 130, y0: 0, y1: 50 }], box, 8, 30)).toBeNull();
    // (a band above or below the box never counts)
    expect(freeShift([{ x0: 0, x1: 130, y0: 120, y1: 150 }], box, 8, 30)).toBe(0);
  });
});

describe('placeHost: every girl on the home, at both sizes', () => {
  for (const vp of ['844x390', '1280x720']) {
    const [W, H] = vp.split('x').map(Number);
    const t = homeTarget(W, H);
    for (const u of UNITS) {
      it(`${u.id} at ${vp}`, () => {
        const a = FACE_ANCHORS[u.id].cut;
        const aspect = PORTRAIT_DATA[u.id].cut;
        const p = placeHost({ W, H, aspect, anchor: a, extents: CUT_EXTENTS[u.id], boxes: boxes(vp) });
        expect(p.fits, `${u.id} fits`).toBe(true);
        expect(p.scale, 'never below 0.8 of her size').toBeGreaterThanOrEqual(0.8 - 1e-9);
        // her face: on the face spot, at most 4 % of the width aside (5.5), her eye line at most 12 % lower
        expect(Math.abs(p.left + a.cx * p.width - t.x)).toBeLessThanOrEqual(W * 0.04 + 0.01);
        const eyeY = p.top + a.eye * p.height;
        expect(eyeY).toBeGreaterThanOrEqual(t.y - 0.01);
        expect(eyeY - t.y).toBeLessThanOrEqual(H * 0.12 + 0.01);
        // her art 8 px clear of every control, band by band
        expect(clearOf(bandsOf(CUT_EXTENTS[u.id], p, H), boxes(vp), 8)).toBe(true);
        // the face box clear of every control (nothing over a face)
        const f = p.face;
        for (const b of boxes(vp)) {
          const apart = f.x + f.w <= b.x || f.x >= b.x + b.w || f.y + f.h <= b.y || f.y >= b.y + b.h;
          expect(apart, `face box vs ${JSON.stringify(b)}`).toBe(true);
        }
      });
    }
  }

  it('Ruri (the mock-ups\' secretary) stands at full size, on the spot, and reaches the bottom edge', () => {
    for (const vp of ['844x390', '1280x720']) {
      const [W, H] = vp.split('x').map(Number);
      const p = placeHost({ W, H, aspect: PORTRAIT_DATA.ruri.cut, anchor: FACE_ANCHORS.ruri.cut, extents: CUT_EXTENTS.ruri, boxes: boxes(vp) });
      expect(p.scale).toBeGreaterThanOrEqual(1);
      expect(p.drop).toBe(0);
      expect(p.floats).toBe(false);
      expect(p.top + p.height).toBeGreaterThanOrEqual(H);
    }
  });

  // (v0.1.48 brought back the seven academy girls' head-to-shoes stands in place of the v0.1.47 scene cut-outs, so the
  // two drawn from above, Chigusa and Yuzuha, reach the bottom edge on a phone too now)
  it('every stand girl reaches the bottom edge, at 1280x720 and on a phone (none floats)', () => {
    const floats = { '844x390': [], '1280x720': [] };
    for (const vp of Object.keys(floats)) {
      const [W, H] = vp.split('x').map(Number);
      for (const u of UNITS) {
        const p = placeHost({ W, H, aspect: PORTRAIT_DATA[u.id].cut, anchor: FACE_ANCHORS[u.id].cut, extents: CUT_EXTENTS[u.id], boxes: boxes(vp) });
        if (p.floats) floats[vp].push(u.id);
      }
    }
    expect(floats['1280x720']).toEqual([]);
    expect(floats['844x390']).toEqual([]);
  });

  it('the face box is ± 8 % of the width around her face (wider for a big face), from her hair to her chin', () => {
    const b = faceBox({ cx: 0.5, brow: 0.1, eye: 0.12, chin: 0.2 }, { left: 0, top: 0, width: 400, height: 1000 }, 844);
    expect(b.w).toBeCloseTo(Math.max(0.16 * 844, 2.2 * 100), 6);
    expect(b.y).toBeCloseTo(100 - 90, 6);
    expect(b.y + b.h).toBeCloseTo(200 + 15, 6);
  });
});

describe('placeScene: a painting with her inside it', () => {
  it('covers the screen, zooms at most 1.5x, and puts her face as close to the spot as that allows', () => {
    for (const vp of ['844x390', '1280x720']) {
      const [W, H] = vp.split('x').map(Number);
      const p = placeScene({ W, H, aspect: 1376 / 768, face: [0.62, 0.26] });
      expect(p.left).toBeLessThanOrEqual(0);
      expect(p.top).toBeLessThanOrEqual(0);
      expect(p.left + p.width).toBeGreaterThanOrEqual(W - 0.01);
      expect(p.top + p.height).toBeGreaterThanOrEqual(H - 0.01);
      expect(p.zoom).toBeLessThanOrEqual(1.5 + 1e-9);
    }
  });
});

describe('Marumi\'s living scene (C5)', () => {
  for (const vp of ['844x390', '1280x720']) {
    const [W, H] = vp.split('x').map(Number);
    it(`at ${vp}: her face on the spot, all her art (ball and hands too) 8 px clear, at least 0.8 of the cover fit`, () => {
      const p = placeMarumi(W, H, boxes(vp));
      expect(p.fits).toBe(true);
      expect(p.rel).toBeGreaterThanOrEqual(0.8 - 1e-9);
      const t = homeTarget(W, H);
      expect(Math.abs(p.left + M_ANCHOR.cx * p.width - t.x)).toBeLessThanOrEqual(W * 0.04 + 0.01);
      expect(clearOf(bandsOf(M_EXTENTS, p, H), boxes(vp), 8)).toBe(true);
      // her figure (with its 48 px of skirt under the frame) reaches the screen's bottom edge; the scrim lies over it
      expect(p.floats).toBe(false);
      expect(p.height / p.width).toBeCloseTo((FRAME.h + FRAME.ext) / FRAME.w, 6);
    });
  }
  it('her extents cover 40 bands of her 828 px figure, her face painted where her anchor says', () => {
    expect(M_EXTENTS).toHaveLength(40);
    const band = M_EXTENTS[Math.floor(M_ANCHOR.eye * 40)];
    expect(band[0]).toBeLessThanOrEqual(M_ANCHOR.cx);
    expect(band[1]).toBeGreaterThanOrEqual(M_ANCHOR.cx);
  });
});

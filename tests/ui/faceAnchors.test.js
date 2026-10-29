// [ui-ink] UI v2 V2: every girl's face anchors (src/ui/faceAnchors.js), read off the contact sheets of
// tools/art/faceSheet.mjs: all 36 girls have a -cut and a -card entry, each in sane ranges (the brow above the eyes,
// the eyes above the chin, a face of a believable size, inside the picture), and every -cut has its paint extents.
// Right or wrong is checked by eye on the --overlay sheet; this checks they exist and hang together.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { UNITS } from '../../src/data/units.js';
import { FACE_ANCHORS, CUT_EXTENTS, faceAnchor, cutExtents, DEFAULT_ANCHOR, DEFAULT_EXTENTS } from '../../src/ui/faceAnchors.js';

describe('face anchors', () => {
  it('every girl (39: Tenka with the ultimates; the duo, Kogane and Norika with banners) has both entries, and no stray girl has one', () => {
    expect(UNITS).toHaveLength(39);
    for (const u of UNITS) {
      expect(FACE_ANCHORS[u.id]?.cut, `${u.id} cut`).toBeTruthy();
      expect(FACE_ANCHORS[u.id]?.card, `${u.id} card`).toBeTruthy();
      expect(existsSync(`public/art/portraits/${u.id}-cut.webp`), `${u.id}-cut.webp`).toBe(true);
      expect(existsSync(`public/art/portraits/${u.id}-card.webp`), `${u.id}-card.webp`).toBe(true);
    }
    expect(Object.keys(FACE_ANCHORS).sort()).toEqual(UNITS.map((u) => u.id).sort());
  });

  it('brow above the eyes above the chin, the centre between brow and chin, all inside the picture', () => {
    for (const [id, both] of Object.entries(FACE_ANCHORS)) {
      for (const kind of ['cut', 'card']) {
        const a = both[kind];
        const at = `${id} ${kind}`;
        for (const k of ['cx', 'cy', 'brow', 'eye', 'chin']) expect(a[k], `${at} ${k}`).toBeGreaterThan(0.02);
        for (const k of ['cx', 'cy', 'brow', 'eye', 'chin']) expect(a[k], `${at} ${k}`).toBeLessThan(0.98);
        expect(a.brow, at).toBeLessThan(a.eye);
        expect(a.eye, at).toBeLessThan(a.chin);
        expect(Math.abs(a.cy - (a.brow + a.chin) / 2), at).toBeLessThanOrEqual(0.0006);
        // the eyes in the face's upper half
        expect(a.eye, at).toBeLessThan(a.cy);
      }
    }
  });

  it('a believable face: brow to chin 3.5-16 % of a -cut (a stand: the face is small), 6-30 % of a -card', () => {
    for (const [id, { cut, card }] of Object.entries(FACE_ANCHORS)) {
      expect(cut.chin - cut.brow, `${id} cut`).toBeGreaterThan(0.035);
      expect(cut.chin - cut.brow, `${id} cut`).toBeLessThan(0.16);
      expect(card.chin - card.brow, `${id} card`).toBeGreaterThan(0.06);
      expect(card.chin - card.brow, `${id} card`).toBeLessThan(0.3);
    }
  });

  it('the -cut faces sit in the top half of their stand, and the -card faces in the top two thirds', () => {
    for (const [id, { cut, card }] of Object.entries(FACE_ANCHORS)) {
      expect(cut.chin, `${id} cut`).toBeLessThan(0.5);
      expect(card.chin, `${id} card`).toBeLessThan(0.67);
    }
  });

  it('every -cut has its paint extents: 20 bands of [x0, x1] inside 0..1 (or empty)', () => {
    for (const u of UNITS) {
      const e = CUT_EXTENTS[u.id];
      expect(e, u.id).toHaveLength(20);
      for (const b of e) {
        if (b == null) continue;
        expect(b[0], u.id).toBeGreaterThanOrEqual(0);
        expect(b[1], u.id).toBeLessThanOrEqual(1);
        expect(b[0], u.id).toBeLessThan(b[1]);
      }
      // her face is painted: the band of her eye line has paint across her face centre
      const a = FACE_ANCHORS[u.id].cut;
      const band = e[Math.floor(a.eye * 20)];
      expect(band && band[0] <= a.cx && band[1] >= a.cx, `${u.id}: paint at her face`).toBe(true);
    }
  });

  it('a girl with no entry falls back to the defaults (a new girl before her line is measured)', () => {
    expect(faceAnchor('nobody', 'cut')).toBe(DEFAULT_ANCHOR.cut);
    expect(faceAnchor('nobody', 'card')).toBe(DEFAULT_ANCHOR.card);
    expect(cutExtents('nobody')).toBe(DEFAULT_EXTENTS);
    expect(faceAnchor('ruri')).toBe(FACE_ANCHORS.ruri.cut);
  });
});

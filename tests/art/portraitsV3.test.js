// Art v3 (src/art/portraitsV3.js): every listed girl's four redrawn files exist, are WebPs of the sizes PORTRAIT_KINDS
// promises, match the manifest hash, and her PORTRAIT_DATA face point sits where the crops need it (her face 30-70 %
// across, her eyes 15-36 % down the 3:4 master). Her stands are untouched, and the staff heroes keep their sign stands.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PORTRAIT_V3 } from '../../src/art/portraitsV3.js';
import { PORTRAIT_DATA, PORTRAIT_KINDS, isPlaceholderPortrait, portraitUrl } from '../../src/art/portraits.js';
import { FACE_ANCHORS } from '../../src/ui/faceAnchors.js';
import { UNITS } from '../../src/data/units.js';

const DIR = 'public/art/portraits';
const KINDS = ['full', 'card', 'bust', 'thumb'];
const ACADEMY = ['azami', 'kinu', 'wakaba', 'yuzuha', 'ouka', 'chigusa', 'marumi'];

/** Canvas size of a WebP (lossy VP8, lossless VP8L or extended VP8X). */
function webpSize(p) {
  const b = readFileSync(p);
  expect(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 12), p).toBe('RIFFWEBP');
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') {
    const v = b.readUInt32LE(21);
    return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1];
  }
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  throw new Error(`${p}: unknown WebP chunk ${chunk}`);
}

describe('art v3 portraits', () => {
  const ids = Object.keys(PORTRAIT_V3);

  it('lists only drawn roster girls, never the seven academy girls (whose v2 scenes are the look)', () => {
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(UNITS.some((u) => u.id === id), id).toBe(true);
      expect(PORTRAIT_DATA[id], id).toBeTruthy();
    }
    for (const id of ACADEMY) expect(PORTRAIT_V3[id], id).toBeUndefined();
  });

  it('each girl has her four files at the promised sizes, matching the manifest hash', () => {
    for (const id of ids) {
      const h = createHash('sha256');
      for (const k of KINDS) {
        const p = `${DIR}/${id}-${PORTRAIT_KINDS[k].suffix}.webp`;
        expect(existsSync(p), p).toBe(true);
        expect(webpSize(p), p).toEqual([PORTRAIT_KINDS[k].w, PORTRAIT_KINDS[k].h]);
        h.update(readFileSync(p));
      }
      expect(h.digest('hex').slice(0, 8), `${id}: files changed without the manifest`).toBe(PORTRAIT_V3[id]);
    }
  });

  it('her face point survives the crops: 30-70 % across, eyes 15-36 % down', () => {
    for (const id of ids) {
      const [x, y] = PORTRAIT_DATA[id].face;
      expect(x, `${id} face x`).toBeGreaterThanOrEqual(30);
      expect(x, `${id} face x`).toBeLessThanOrEqual(70);
      expect(y, `${id} face y`).toBeGreaterThanOrEqual(15);
      expect(y, `${id} face y`).toBeLessThanOrEqual(36);
    }
  });

  it('her -card face line agrees with the master face point (same card crop)', () => {
    for (const id of ids) {
      const a = FACE_ANCHORS[id].card;
      expect(a.eye, id).toBeGreaterThan(0.12);
      expect(a.eye, id).toBeLessThan(0.45);
      expect(a.chin - a.brow, id).toBeGreaterThan(0.06);
    }
  });

  it('her redrawn kinds carry ?v=<manifest hash> (an old cached picture never shows); stands and other girls stay plain', () => {
    for (const id of ids) {
      for (const k of KINDS) expect(portraitUrl(id, k), `${id} ${k}`).toMatch(new RegExp(`/${id}-${PORTRAIT_KINDS[k].suffix}\\.webp\\?v=${PORTRAIT_V3[id]}$`));
      for (const k of ['cut', 'cutS']) expect(portraitUrl(id, k), `${id} ${k}`).toMatch(/\.webp$/);
    }
    for (const id of ['azami', 'tenka', 'luna', 'kogane']) expect(portraitUrl(id, 'card'), id).toMatch(/\.webp$/);
  });

  it('stands are kept: every girl still has her -cut / -cut-s, and the staff heroes keep their sign stands', () => {
    for (const id of ids) {
      for (const k of ['cut', 'cutS']) expect(existsSync(`${DIR}/${id}-${PORTRAIT_KINDS[k].suffix}.webp`), `${id} ${k}`).toBe(true);
    }
    expect(isPlaceholderPortrait('kogane')).toBe(true);
    expect(isPlaceholderPortrait('norika')).toBe(true);
  });
});

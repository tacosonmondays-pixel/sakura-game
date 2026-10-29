// The seven academy girls' drawn cards (Oct 2026): their six portrait files replaced the coming-soon
// signboards they shipped with in v0.1.40 (tools/art/placeholder_portraits.py). Display only: no sim, battle
// data or co-op protocol change. The placeholder system stays for a future girl who ships before her art.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { NEW_GIRL_IDS } from '../../src/data/unitsNewGirls.js';
import {
  PORTRAIT_DATA, PORTRAIT_KINDS, portraitFiles, portraitHTML, portraitUrl, hasPortrait, isPlaceholderPortrait,
} from '../../src/art/portraits.js';

const ROOT = process.cwd();
const fileOf = (url) => join(ROOT, 'public', url.replace(/^.*?art\//, 'art/'));
const ACADEMY = ['azami', 'kinu', 'wakaba', 'yuzuha', 'ouka', 'chigusa', 'marumi'];
// every signboard is the same easel and plate, so every placeholder line had this geometry
const SIGN = { face: [49, 31], cut: 0.621 };
// git blob ids of every signboard file these girls ever shipped (both generations)
const SIGN_BLOBS = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/placeholder-portrait-blobs.json'), 'utf8')).blobs;

/** Width and height from a .webp header (VP8X, VP8 or VP8L), without decoding it. */
function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  if (chunk === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) };
  }
  return null;
}

/** The id git gives a file's bytes (sha1 of "blob <size>\0" + bytes). */
const blobId = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

describe("academy girls' drawn cards", () => {
  it('covers the seven academy girls', () => {
    expect(NEW_GIRL_IDS).toEqual(ACADEMY);
    expect(Object.keys(SIGN_BLOBS)).toHaveLength(ACADEMY.length * Object.keys(PORTRAIT_KINDS).length);
  });

  it('every academy girl has her six files, at the sizes src/art/portraits.js promises', () => {
    for (const id of ACADEMY) {
      expect(hasPortrait(id), id).toBe(true);
      expect(portraitFiles(id), id).toHaveLength(Object.keys(PORTRAIT_KINDS).length);
      for (const [kind, k] of Object.entries(PORTRAIT_KINDS)) {
        const f = fileOf(portraitUrl(id, kind));
        expect(existsSync(f), f).toBe(true);
        const size = webpSize(readFileSync(f));
        expect(size, f).toBeTruthy();
        expect(size.h, f).toBe(k.h);
        // the stands' width follows her pose: it must match her `cut` aspect
        if (k.w) expect(size.w, f).toBe(k.w);
        else expect(Math.abs(size.w / size.h - PORTRAIT_DATA[id].cut), `${f}: ${size.w}x${size.h}`).toBeLessThan(0.004);
      }
    }
  });

  it('no academy girl falls back to the placeholder signboard (or to the SVG doll)', () => {
    for (const id of ACADEMY) {
      const d = PORTRAIT_DATA[id];
      expect(isPlaceholderPortrait(id), id).toBe(false);
      expect(d.placeholder, id).toBeUndefined();
      expect(d.face, id).not.toEqual(SIGN.face);
      expect(d.cut, id).not.toBe(SIGN.cut);
      // her drawn face high in the 3:4 illustration: the v2 scene portraits put it at 19-33 % down (the sign's
      // mascot sat at 49 % across, 31 % down, so the face line differs from the sign's in either coordinate)
      expect(d.face[1], id).toBeLessThan(35);
      for (const kind of Object.keys(PORTRAIT_KINDS)) {
        const f = `${id}-${PORTRAIT_KINDS[kind].suffix}.webp`;
        expect(SIGN_BLOBS[f], f).toBeTruthy();
        expect(SIGN_BLOBS[f], `${f} is a signboard file`).not.toContain(blobId(readFileSync(fileOf(portraitUrl(id, kind)))));
        expect(portraitHTML(UNIT_MAP[id], kind), `${id} ${kind}`).toMatch(/^<img /);
      }
    }
  });

  it("each girl's files are her own (no two academy files are the same picture)", () => {
    const seen = new Map();
    for (const id of ACADEMY) {
      for (const url of portraitFiles(id)) {
        const h = blobId(readFileSync(fileOf(url)));
        expect(seen.get(h), `${url} repeats ${seen.get(h)}`).toBeUndefined();
        seen.set(h, url);
      }
    }
  });

  it('file sizes sit with the shipped girls: light list art, and no full illustration shrunk to a thumbnail', () => {
    // KB ranges around the 28 painted girls' files (their smallest and largest, with room for flat cel colour)
    const RANGE = { full: [30, 250], card: [15, 80], bust: [20, 90], thumb: [4, 20], cut: [40, 180], cutS: [10, 45] };
    for (const id of ACADEMY) {
      for (const [kind, [lo, hi]] of Object.entries(RANGE)) {
        const kb = statSync(fileOf(portraitUrl(id, kind))).size / 1024;
        expect(kb, `${id} ${kind} ${kb.toFixed(1)} KB`).toBeGreaterThan(lo);
        expect(kb, `${id} ${kind} ${kb.toFixed(1)} KB`).toBeLessThan(hi);
      }
    }
  });

  it('only the staff heroes (BANNERS §D.5, before their art) show a signboard today; the placeholder flag works', () => {
    const SIGNBOARD = ['kogane', 'norika'];
    for (const u of UNITS) expect(isPlaceholderPortrait(u.id), u.id).toBe(SIGNBOARD.includes(u.id));
    expect(isPlaceholderPortrait('nobody')).toBe(false);
    PORTRAIT_DATA.__sign = { ...SIGN, placeholder: true };
    try {
      expect(hasPortrait('__sign')).toBe(true);
      expect(isPlaceholderPortrait('__sign')).toBe(true);
      expect(isPlaceholderPortrait({ id: '__sign' })).toBe(true);
    } finally {
      delete PORTRAIT_DATA.__sign;
    }
  });
});

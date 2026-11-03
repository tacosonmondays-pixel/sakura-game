// Cosmetics 2 art: the baked 3D-flat Honor Ribbons (tools/blender/ribbons, src/art/honorArt.js) cover every ribbon of
// this build with both cuts on disk, the ribbon element picks the right cut, and every shipping picture frame has art.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HONOR_RIBBONS } from '../../src/data/honors.js';
import { HONOR_BAKED, HONOR_ART_PAD } from '../../src/art/honorArt.js';
import { honorBakedUrl } from '../../src/ui/honorFx.js';
import { FRAME_IDS } from '../../src/data/profileArt.js';
import { ORNATE_FRAMES, ornateFrameSVG, frameChipSVG } from '../../src/art/profileArt.js';

const DIR = 'public/art/honors';
/** Width and height of a WebP file (VP8, VP8L or VP8X). */
function webpSize(buf) {
  expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buf.toString('ascii', 8, 12)).toBe('WEBP');
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
}

describe('baked ribbons', () => {
  it('every ribbon of this build has a 256 and a 128 px picture, and the manifest hash is their content', () => {
    for (const h of HONOR_RIBBONS) {
      expect(HONOR_BAKED[h.id], h.id).toMatch(/^[0-9a-f]{8}$/);
      const sha = createHash('sha1');
      for (const px of [256, 128]) {
        const p = `${DIR}/${h.id}-${px}.webp`;
        expect(existsSync(p), p).toBe(true);
        const buf = readFileSync(p);
        expect(webpSize(buf), p).toEqual([px, px]);
        expect(buf.length, p).toBeLessThan(px === 256 ? 24 * 1024 : 10 * 1024); // phone-friendly
        sha.update(buf);
      }
      expect(sha.digest('hex').slice(0, 8), h.id).toBe(HONOR_BAKED[h.id]);
    }
    expect(Object.keys(HONOR_BAKED).sort()).toEqual(HONOR_RIBBONS.map((h) => h.id).sort());
    expect(readdirSync(DIR).filter((f) => f.endsWith('.webp'))).toHaveLength(HONOR_RIBBONS.length * 2); // no strays
    expect(HONOR_ART_PAD).toBe(2);
  });

  it('the element picks the 128 px cut up to the 64 px Case grid and the 256 px cut for the detail', () => {
    expect(honorBakedUrl('a_chapter_1', 40)).toMatch(/art\/honors\/a_chapter_1-128\.webp\?v=[0-9a-f]{8}$/);
    expect(honorBakedUrl('a_chapter_1', 64)).toContain('-128.webp');
    expect(honorBakedUrl('a_chapter_1', 160)).toContain('-256.webp');
    expect(honorBakedUrl('a_no_such_ribbon', 64)).toBe(null);
  });
});

describe('frame art', () => {
  it('every shipping frame draws: the Cosmetics 2 frames from ornateFrameSVG, the older three their own way', () => {
    for (const id of FRAME_IDS) {
      if (['ur', 'eclipse', 'pumpkin'].includes(id)) continue;
      expect(ORNATE_FRAMES, id).toContain(id);
      const svg = ornateFrameSVG(id);
      expect(svg.startsWith('<svg class="pf-ava-frame" viewBox="0 0 100 100"'), id).toBe(true);
      expect(svg.endsWith('</svg>'), id).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(frameChipSVG(id).startsWith('<svg viewBox="0 0 100 100"'), id).toBe(true);
    }
    // gradient ids are per instance: two copies on one screen never share one
    const ids = (s) => [...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids(ornateFrameSVG('sakura'))).not.toEqual(ids(ornateFrameSVG('sakura')));
  });
});

// Baked 3D-flat item art (tools/blender/items, public/art/items, manifest src/art/itemArt.js): every manifest key
// is a real art key, its files exist and are RGBA WebPs of the right size, the manifest hashes match the files,
// no stray file sits in the folder, and the size budget holds (per file and in total).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEM_ART, ITEM_ART_SMALL } from '../../src/art/itemArt.js';
import { ITEMS } from '../../src/data/items.js';
import { GEAR_SLOTS, ITEM_RARITY_ORDER } from '../../src/data/types.js';
import { CLUBS } from '../../src/data/clubs.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', '..', 'public', 'art', 'items');
const CAP = { 256: 20 * 1024, 128: 9 * 1024, small: 5 * 1024 };
const TOTAL_CAP = 2.2 * 1024 * 1024;
const PX = { 256: 256, 128: 128, small: 96 };

const ART_KEYS = new Set([
  ...Object.keys(ITEMS),
  ...Object.keys(GEAR_SLOTS).flatMap((s) => [...ITEM_RARITY_ORDER.map((r) => `gear_${s}_${r}`), `gear_${s}_ur`]),
  'recruitPoints',
]);

/** A set look (tools/blender/items catalog.GEAR_SETS): gear_<slot>_<rarity|ur>_<club id>. */
const isSetKey = (k) => {
  const m = /^gear_([a-z]+)_([a-zA-Z]+)_([a-z0-9]+)$/.exec(k);
  return Boolean(m && ART_KEYS.has(`gear_${m[1]}_${m[2]}`) && CLUBS[m[3]]);
};

const file = (key, size) => path.join(dir, `${key}-${size}.webp`);

/** RIFF/WEBP with a VP8X header: alpha flag and canvas size. */
function webpInfo(p) {
  const b = readFileSync(p);
  return {
    riff: b.toString('ascii', 0, 4),
    webp: b.toString('ascii', 8, 12),
    chunk: b.toString('ascii', 12, 16),
    alpha: (b[20] & 0x10) !== 0,
    w: 1 + b.readUIntLE(24, 3),
    h: 1 + b.readUIntLE(27, 3),
  };
}

const sha8 = (paths) => {
  const h = createHash('sha1');
  for (const p of paths) h.update(readFileSync(p));
  return h.digest('hex').slice(0, 8);
};

describe('item art', () => {
  it('every manifest key is an item id, a gear key (or a gear set look) or recruitPoints', () => {
    expect(Object.keys(ITEM_ART).length).toBeGreaterThan(0);
    for (const k of Object.keys(ITEM_ART)) expect(ART_KEYS.has(k) || isSetKey(k), k).toBe(true);
    for (const k of Object.keys(ITEM_ART_SMALL)) expect(ITEM_ART[k], `${k} small cut without full art`).toBeTruthy();
  });

  it('files exist, are RGBA WebP at 256 / 128 / 96 px, and match the manifest hashes', () => {
    for (const [k, hash] of Object.entries(ITEM_ART)) {
      for (const size of ['256', '128']) {
        const p = file(k, size);
        expect(existsSync(p), p).toBe(true);
        const info = webpInfo(p);
        expect([info.riff, info.webp, info.chunk], p).toEqual(['RIFF', 'WEBP', 'VP8X']);
        expect(info.alpha, p).toBe(true);
        expect([info.w, info.h], p).toEqual([PX[size], PX[size]]);
      }
      expect(sha8([file(k, '256'), file(k, '128')]), `${k}: re-run build_items.py (manifest out of date)`).toBe(hash);
    }
    for (const [k, hash] of Object.entries(ITEM_ART_SMALL)) {
      const p = file(k, 'small');
      expect(existsSync(p), p).toBe(true);
      const info = webpInfo(p);
      expect(info.alpha && info.w === PX.small && info.h === PX.small, p).toBe(true);
      expect(sha8([p]), k).toBe(hash);
    }
  });

  it('the shipped keys are the owner-approved files byte for byte (PLAN C11: tools/blender/items models.SHIPPED)', () => {
    // crown_rainbow_256.webp from the approved set; the 128 cut is downscaled from it by post.ship
    const SHIPPED = { crown_rainbow: 'af538b922da027ae8e542b0b76711b7e3b6ffef0' };
    for (const [k, sha1] of Object.entries(SHIPPED)) {
      expect(createHash('sha1').update(readFileSync(file(k, '256'))).digest('hex'), k).toBe(sha1);
      expect(ITEM_ART[k], k).toBeTruthy();
    }
  });

  it('holds the size caps and has no stray files', () => {
    let total = 0;
    const listed = new Set();
    for (const k of Object.keys(ITEM_ART)) ['256', '128'].forEach((s) => listed.add(`${k}-${s}.webp`));
    for (const k of Object.keys(ITEM_ART_SMALL)) listed.add(`${k}-small.webp`);
    for (const f of readdirSync(dir)) {
      expect(listed.has(f), `stray file public/art/items/${f}`).toBe(true);
      const bytes = statSync(path.join(dir, f)).size;
      const size = f.match(/-(256|128|small)\.webp$/)[1];
      expect(bytes, f).toBeLessThanOrEqual(CAP[size]);
      total += bytes;
    }
    expect(total).toBeLessThanOrEqual(TOTAL_CAP);
  });
});

// Golden digests of every shipped map's WHOLE definition (the MapDef as MAPS exports it: rows, tracks,
// crossings, decor, theme, district, city hints, words: everything), one per map. Where tracksGolden pins
// the road geometry the sim walks, this pins the bytes: a shipped map that changes in any way moves its
// digest. Taken on feature/gate-arc after the viaduct merge (73780c1f), which left all 74 shipped maps
// byte-identical (its review compared every MapDef node against the base). New maps are added only after
// their review:
//   UPDATE_MAPS_GOLDEN=1 npx vitest run tests/core/mapsGolden.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAPS } from '../../src/data/maps.js';

const GOLDEN_FILE = fileURLToPath(new URL('./mapsGolden.json', import.meta.url));
const UPDATE = process.env.UPDATE_MAPS_GOLDEN === '1';

/** FNV-1a over a string (JSON spells every double exactly) → 8 hex digits. */
function fnv(text, h = 0x811c9dc5) {
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

describe('shipped maps are unchanged, byte for byte (golden digests)', () => {
  const now = Object.fromEntries(MAPS.map((m) => [m.id, fnv(JSON.stringify(m))]));

  if (UPDATE) {
    it('writes the golden', () => {
      writeFileSync(GOLDEN_FILE, `${JSON.stringify(now, null, 2)}\n`);
      expect(Object.keys(now).length).toBe(MAPS.length);
    });
    return;
  }

  const golden = JSON.parse(readFileSync(GOLDEN_FILE, 'utf8'));

  it('covers the 74 shipped maps', () => {
    expect(Object.keys(golden).length).toBe(74);
  });

  it('every shipped map keeps its whole definition bit for bit', () => {
    expect(Object.keys(golden).filter((id) => now[id] !== golden[id])).toEqual([]);
  });

  it('no shipped map lost its golden entry', () => {
    expect(Object.keys(golden).filter((id) => !(id in now))).toEqual([]);
  });
});

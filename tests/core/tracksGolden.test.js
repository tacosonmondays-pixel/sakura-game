// Golden digests of every shipped map's road geometry: the dense tracks the sim walks and the
// renderer draws (points, cum, length, tunnels, elevation, under-deck spans, fork / join, inside,
// control points: the WHOLE track object, so a new key on a shipped track moves it too) and every
// resolved crossing (x, y, a, b, angle, mode, over).
//
// Taken on feature/gate-arc 04ace86c (Gate Arc Step 6 plan) BEFORE any viaduct code touched
// src/core/track.js (STEP6_BUILD_PLAN §4): the viaduct markers, profile and crossing rule must leave
// all 74 shipped maps byte-identical. New maps are added to the golden only after their review:
//   UPDATE_TRACKS_GOLDEN=1 npx vitest run tests/core/tracksGolden.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAPS } from '../../src/data/maps.js';

const GOLDEN_FILE = fileURLToPath(new URL('./tracksGolden.json', import.meta.url));
const UPDATE = process.env.UPDATE_TRACKS_GOLDEN === '1';

/** FNV-1a over a string (JSON spells every double exactly) → 8 hex digits. */
function fnv(text, h = 0x811c9dc5) {
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** One map's digest: every track object whole, then every crossing. */
function mapTracksDigest(map) {
  return fnv(JSON.stringify({ tracks: map.tracks, crossings: map.crossings }));
}

describe('shipped tracks are unchanged (golden digests)', () => {
  const now = Object.fromEntries(MAPS.map((m) => [m.id, mapTracksDigest(m)]));

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

  it('every shipped map keeps its tracks and crossings bit for bit', () => {
    const moved = Object.keys(golden).filter((id) => now[id] !== golden[id]);
    expect(moved).toEqual([]);
  });

  it('no shipped map lost its golden entry', () => {
    expect(Object.keys(golden).filter((id) => !(id in now))).toEqual([]);
  });
});

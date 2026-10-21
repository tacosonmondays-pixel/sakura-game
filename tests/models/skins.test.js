// Outfit (Sentinel Style) and Coming Soon model files: byte copies of the V2 GLBs, so their
// headers still name the source unit (docs/merge/ROSTER_SPEC.md §3.2). glb.test.js covers the
// default <unitId>.glb files and is not edited.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKINS } from '../../src/data/skins.js';
import { FUTURE_UNITS } from '../../src/data/future.js';
import { readGlbHeader } from './glbHeader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', '..', 'public', 'models', 'characters');
const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const MAX_FULL_BYTES = 480 * 1024;
const MAX_LOD_BYTES = 240 * 1024;

const ASSETS = [
  ...SKINS.filter((s) => s.kind !== 'default').map((s) => ({ key: s.asset, unit: s.unitId, hero: s.unitId === 'hikari' })),
  ...FUTURE_UNITS.map((f) => ({ key: f.asset, unit: f.from, hero: f.kind === 'hero' })),
];

describe('outfit and Coming Soon models', () => {
  it('there are 15 outfit and 4 Coming Soon files', () => {
    expect(ASSETS).toHaveLength(19);
    expect(ASSETS.filter((a) => a.key.startsWith('sentinel-'))).toHaveLength(15);
    expect(ASSETS.filter((a) => a.key.startsWith('future-'))).toHaveLength(4);
  });

  for (const a of ASSETS) {
    it(`${a.key}: manifest entry, full + lod files, header names the source unit`, () => {
      const m = manifest[a.key];
      expect(m, a.key).toBeTruthy();
      expect(m.file).toBe(`${a.key}.glb`);
      expect(m.lod).toBe(`${a.key}.lod.glb`);
      for (const detail of ['full', 'lod']) {
        const file = path.join(dir, detail === 'lod' ? m.lod : m.file);
        expect(existsSync(file), file).toBe(true);
        const size = statSync(file).size;
        expect(size).toBe(detail === 'lod' ? m.lodSize : m.size);
        expect(size).toBeLessThanOrEqual(detail === 'lod' ? MAX_LOD_BYTES : MAX_FULL_BYTES);
        const { json } = readGlbHeader(file);
        expect(json.asset.extras.unit).toBe(a.unit);
        expect(json.asset.extras.lod).toBe(detail === 'lod');
        expect(json.asset.extras.height).toBeCloseTo(a.hero ? 0.98 : 0.9, 5);
        expect(json.meshes.flatMap((x) => x.primitives)).toHaveLength(3);
        expect(json.skins).toHaveLength(1);
        const names = json.animations.map((x) => x.name);
        for (const c of ['idle', 'walk', 'cheer', 'victory', 'hurt', 'pickup']) expect(names, `${a.key} ${c}`).toContain(c);
        expect(names.some((n) => n.startsWith('attack_'))).toBe(true);
        expect([...names].sort()).toEqual([...m.animations].sort());
      }
    });
  }
});

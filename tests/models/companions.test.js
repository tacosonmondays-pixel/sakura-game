// Checks the companion figures (public/models/companions: Kon, Kaze, the drone marionette) without WebGL:
// the manifest, both files per companion, the exact clip names, the size budgets and the home contract that a
// later Meshy version must keep (docs/MODELS.md "Companions"). Display only: nothing here is read by the sim.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlbHeader } from './glbHeader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', '..', 'public', 'models', 'companions');
const charDir = path.join(here, '..', '..', 'public', 'models', 'characters');

const COMPANIONS = { kon: 'ruri', kaze: 'hana', doll: 'yoriko' };
const CLIPS = ['appear', 'attack', 'idle', 'move'];
const MAX_FULL_BYTES = 150 * 1024;
const MAX_LOD_BYTES = 80 * 1024;
// standing height at game scale (m): Kon about a 0.9 m girl's knee, Kaze a shoulder-perch bird, the doll about a
// third of Yoriko (0.98 m)
const HEIGHT = { kon: [0.12, 0.22], kaze: [0.12, 0.26], doll: [0.25, 0.38] };

const manifestPath = path.join(dir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
const characters = JSON.parse(readFileSync(path.join(charDir, 'manifest.json'), 'utf8'));

function joints(file) {
  const { json } = readGlbHeader(file);
  return (json.skins?.[0]?.joints || []).map((j) => json.nodes[j].name);
}

describe('companion figures', () => {
  it('has a manifest entry for exactly Kon, Kaze and the doll', () => {
    expect(manifest).toBeTruthy();
    expect(Object.keys(manifest).sort()).toEqual(Object.keys(COMPANIONS).sort());
  });

  for (const [id, owner] of Object.entries(COMPANIONS)) {
    describe(id, () => {
      const m = manifest?.[id] || {};

      it('lists its files, byte sizes, clips, height and home', () => {
        expect(m.file).toBe(`${id}.glb`);
        expect(m.lod).toBe(`${id}.lod.glb`);
        expect([...m.clips].sort()).toEqual(CLIPS);
        expect(m.height).toBeGreaterThan(HEIGHT[id][0]);
        expect(m.height).toBeLessThan(HEIGHT[id][1]);
        expect(m.owner).toBe(owner);
        expect(m.home.offset).toHaveLength(3);
        for (const v of m.home.offset) expect(Number.isFinite(v)).toBe(true);
      });

      it('stays within the size budgets and the manifest bytes match the files', () => {
        const full = statSync(path.join(dir, m.file)).size;
        const lod = statSync(path.join(dir, m.lod)).size;
        expect(full).toBe(m.bytes);
        expect(lod).toBe(m.lodBytes);
        expect(full).toBeLessThanOrEqual(MAX_FULL_BYTES);
        expect(lod).toBeLessThanOrEqual(MAX_LOD_BYTES);
        expect(lod).toBeLessThan(full);
      });

      for (const detail of ['file', 'lod']) {
        it(`${detail}: ships exactly the clips idle, move, attack, appear on one skinned figure`, () => {
          const { json } = readGlbHeader(path.join(dir, m[detail]));
          expect(json.animations.map((a) => a.name).sort()).toEqual(CLIPS);
          expect(json.skins).toHaveLength(1);
          for (const a of json.animations) {
            const input = json.accessors[a.samplers[0].input];
            expect(input.max[0], `${a.name} duration`).toBeGreaterThan(0.2);
            expect(input.max[0], `${a.name} duration`).toBeLessThan(3.01);
          }
          const extras = json.asset.extras || {};
          expect(extras.companion).toBe(id);
          expect(extras.owner).toBe(owner);
          expect(extras.height).toBeCloseTo(m.height, 3);
          expect(extras.unitScale).toBeGreaterThan(0);
          expect(extras.home.offset).toEqual(m.home.offset);
          if (m.source !== 'meshy') {
            // the girls' material set: vertex colours, the painted face atlas, the glow
            expect(json.materials.map((x) => x.name).sort()).toEqual(['body', 'halo', 'head']);
            expect(json.images).toHaveLength(1);
            expect(extras.faceCells).toEqual(['idle', 'blink', 'attack', 'happy']);
            expect(json.extensionsUsed).toContain('KHR_mesh_quantization');
          }
        });
      }

      it("follows a bone its girl's figure really has", () => {
        expect(characters[owner], `${owner} has a character GLB`).toBeTruthy();
        if (m.home.follow == null) return;
        expect(joints(path.join(charDir, characters[owner].file))).toContain(m.home.follow);
        if (characters[owner].lod) expect(joints(path.join(charDir, characters[owner].lod))).toContain(m.home.follow);
      });
    });
  }

  it('battleScale (battle only) stays a modest lift; Kaze is 1.3x so he reads at the default battle zoom', () => {
    for (const [id, m] of Object.entries(manifest)) {
      if (m.battleScale == null) continue;
      expect(m.battleScale, id).toBeGreaterThanOrEqual(1);
      expect(m.battleScale, id).toBeLessThanOrEqual(2.5);
    }
    expect(manifest.kaze.battleScale).toBeCloseTo(1.3, 5);
    // owner (Oct 21): Kon was too tiny, so he is drawn 2.4x in battle and on Ruri's page
    expect(manifest.kon.battleScale).toBeCloseTo(2.4, 5);
    expect(manifest.kon.pageScale).toBeCloseTo(2.4, 5);
    for (const [id, m] of Object.entries(manifest)) if (m.pageScale != null) expect(m.pageScale, id).toBeGreaterThanOrEqual(1);
  });

  it("the doll's threads ride a 'bar' bone the runtime can pin to Yoriko's control bar", () => {
    const { json } = readGlbHeader(path.join(dir, manifest.doll.file));
    expect(json.asset.extras.threads.bone).toBe('bar');
    expect(joints(path.join(dir, manifest.doll.file))).toContain('bar');
  });
});

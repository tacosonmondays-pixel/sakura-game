// Checks the generated character GLBs (public/models/characters) without WebGL: parses the
// GLB JSON header in node and verifies every unit ships the actions, bones, materials and
// face atlas the runtime relies on, within the size budget.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNITS } from '../../src/data/units.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', '..', 'public', 'models', 'characters');

const REQUIRED_CLIPS = ['idle', 'walk', 'cheer', 'victory', 'hurt', 'pickup'];
const REQUIRED_BONES = [
  'root', 'hips', 'spine', 'chest', 'neck', 'head', 'halo',
  'shoulder_L', 'upper_arm_L', 'forearm_L', 'hand_L', 'shoulder_R', 'upper_arm_R', 'forearm_R', 'hand_R',
  'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R',
];
const MAX_FULL_BYTES = 480 * 1024;
const MAX_LOD_BYTES = 240 * 1024;

/** Parses a GLB file: returns { json, binLength }. */
export function readGlbHeader(file) {
  const buf = readFileSync(file);
  expect(buf.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  expect(buf.readUInt32LE(4)).toBe(2);
  const total = buf.readUInt32LE(8);
  expect(total).toBe(buf.length);
  let off = 12;
  let json = null;
  let binLength = 0;
  while (off < total) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    off += 8;
    if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off, off + len).toString('utf8'));
    else if (type === 0x004e4942) binLength = len;
    off += len;
  }
  return { json, binLength };
}

const manifest = existsSync(path.join(dir, 'manifest.json')) ? JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) : null;

describe('character GLBs', () => {
  it('has a manifest listing every unit', () => {
    expect(manifest).toBeTruthy();
    for (const u of UNITS) {
      expect(manifest[u.id], u.id).toBeTruthy();
      expect(manifest[u.id].file).toBe(`${u.id}.glb`);
      expect(manifest[u.id].lod).toBe(`${u.id}.lod.glb`);
    }
  });

  for (const u of UNITS) {
    for (const detail of ['full', 'lod']) {
      it(`${u.id} ${detail}: valid GLB with actions, rig, materials, face atlas`, () => {
        const file = path.join(dir, `${u.id}${detail === 'lod' ? '.lod' : ''}.glb`);
        expect(existsSync(file), file).toBe(true);
        const size = statSync(file).size;
        expect(size).toBeLessThanOrEqual(detail === 'lod' ? MAX_LOD_BYTES : MAX_FULL_BYTES);
        const { json, binLength } = readGlbHeader(file);
        expect(binLength).toBeGreaterThan(0);
        expect(json.buffers[0].byteLength).toBeLessThanOrEqual(binLength);
        // extras written by the pipeline
        expect(json.asset.extras.unit).toBe(u.id);
        expect(json.asset.extras.unitScale).toBe(2);
        expect(json.asset.extras.height).toBeCloseTo(u.kind === 'hero' ? 0.98 : 0.9, 5);
        expect(json.asset.extras.faceCells).toContain('idle');
        expect(json.asset.extras.lod).toBe(detail === 'lod');
        // actions
        const names = json.animations.map((a) => a.name);
        for (const c of REQUIRED_CLIPS) expect(names, `${u.id} ${c}`).toContain(c);
        expect(names.some((n) => n.startsWith('attack_')), `${u.id} attack clip`).toBe(true);
        for (const a of json.animations) {
          expect(a.channels.length).toBeGreaterThan(0);
          for (const s of a.samplers) expect(s.interpolation).toBe('CUBICSPLINE');
        }
        // rig
        expect(json.skins).toHaveLength(1);
        const joints = json.skins[0].joints.map((j) => json.nodes[j].name);
        for (const b of REQUIRED_BONES) expect(joints, `${u.id} bone ${b}`).toContain(b);
        if (['twintails'].includes(u.look.hairStyle)) expect(joints).toEqual(expect.arrayContaining(['tail_L', 'tail_R']));
        if (['long', 'hime', 'wavy', 'ponytail', 'braid'].includes(u.look.hairStyle)) expect(joints).toContain('hair_back');
        // materials + primitives
        const mats = json.materials.map((m) => m.name);
        expect(mats).toEqual(expect.arrayContaining(['head', 'body', 'halo']));
        const prims = json.meshes.flatMap((m) => m.primitives);
        expect(prims.length).toBe(3);
        for (const p of prims) {
          const mat = json.materials[p.material].name;
          const attrs = p.attributes;
          expect(attrs.POSITION).toBeDefined();
          expect(attrs.NORMAL).toBeDefined();
          expect(attrs.JOINTS_0).toBeDefined();
          expect(attrs.WEIGHTS_0).toBeDefined();
          const pos = json.accessors[attrs.POSITION];
          expect(pos.componentType).toBe(5122); // int16, KHR_mesh_quantization
          expect(pos.normalized).toBe(true);
          if (mat === 'head') {
            expect(attrs.TEXCOORD_0).toBeDefined();
          } else {
            expect(attrs.COLOR_0).toBeDefined();
          }
        }
        expect(json.extensionsRequired).toContain('KHR_mesh_quantization');
        // one embedded PNG face atlas
        expect(json.images).toHaveLength(1);
        expect(json.images[0].mimeType).toBe('image/png');
        const headMat = json.materials.find((m) => m.name === 'head');
        expect(headMat.pbrMetallicRoughness.baseColorTexture).toBeDefined();
      });
    }
  }

  it('LOD files are much lighter than the full models', () => {
    for (const u of UNITS) {
      const full = statSync(path.join(dir, `${u.id}.glb`)).size;
      const lod = statSync(path.join(dir, `${u.id}.lod.glb`)).size;
      expect(lod).toBeLessThan(full * 0.65);
    }
  });
});

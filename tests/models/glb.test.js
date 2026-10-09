// Checks the generated character GLBs (public/models/characters) without WebGL: parses the
// GLB JSON header in node and verifies every unit ships the actions, bones, materials and
// face atlas the runtime relies on, within the size budget.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNITS } from '../../src/data/units.js';
import { readGlbHeader } from './glbHeader.js';

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
// imported Meshy figures (tools/meshy/build_meshy_chibi.py): painted texture + sword, phone-packed
const MAX_MESHY_FULL_BYTES = 2.5 * 1024 * 1024;
const MAX_MESHY_LOD_BYTES = 1.25 * 1024 * 1024;
const MESHY_CLIPS = ['idle', 'walk', 'cheer', 'hurt'];
const MESHY_BONES = [
  'root', 'hips', 'spine', 'chest', 'neck', 'head', 'upper_arm_L', 'forearm_L', 'hand_L', 'upper_arm_R', 'forearm_R', 'hand_R',
  'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R',
];

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
    if (manifest?.[u.id]?.source === 'meshy') {
      for (const detail of ['full', 'lod']) {
        it(`${u.id} ${detail}: imported Meshy figure with textured body, sword, rig and clips`, () => {
          const file = path.join(dir, `${u.id}${detail === 'lod' ? '.lod' : ''}.glb`);
          expect(existsSync(file), file).toBe(true);
          expect(statSync(file).size).toBeLessThanOrEqual(detail === 'lod' ? MAX_MESHY_LOD_BYTES : MAX_MESHY_FULL_BYTES);
          const { json, binLength } = readGlbHeader(file);
          expect(json.buffers[0].byteLength).toBeLessThanOrEqual(binLength);
          const ex = json.asset.extras;
          expect(ex.unit).toBe(u.id);
          expect(ex.source).toBe('meshy');
          expect(ex.style).toBe('textured');
          expect(ex.lod).toBe(detail === 'lod');
          expect(ex.height).toBeGreaterThan(1.2); // battle size the owner approved (~1.5x the cage girls)
          expect(ex.unitScale).toBeGreaterThan(0);
          const names = json.animations.map((a) => a.name);
          for (const c of MESHY_CLIPS) expect(names, `${u.id} ${c}`).toContain(c);
          expect(names.some((n) => n.startsWith('attack_')), `${u.id} attack clip`).toBe(true);
          for (const a of json.animations) {
            expect(a.channels.length).toBeGreaterThan(0);
            const dur = Math.max(...a.samplers.map((s) => json.accessors[s.input].max[0]));
            const cap = { idle: 1.6, cheer: 1.2, hurt: 0.4, walk: 1.2 }[a.name] ?? (a.name.startsWith('attack_') ? 0.6 : 2);
            expect(dur, `${a.name} length`).toBeLessThanOrEqual(cap + 1e-3);
          }
          expect(json.skins).toHaveLength(1);
          const joints = json.skins[0].joints.map((j) => json.nodes[j].name);
          for (const b of MESHY_BONES) expect(joints, `${u.id} bone ${b}`).toContain(b);
          // the sword hangs off the right hand
          const hand = json.nodes.findIndex((n) => n.name === 'hand_R');
          const sword = json.nodes.findIndex((n) => n.name === 'sword');
          expect(json.nodes[hand].children).toContain(sword);
          const prims = json.meshes.flatMap((m) => m.primitives);
          const textured = prims.filter((p) => json.materials[p.material].pbrMetallicRoughness?.baseColorTexture);
          expect(textured).toHaveLength(1);
          expect(textured[0].attributes.TEXCOORD_0).toBeDefined();
          expect(textured[0].attributes.JOINTS_0).toBeDefined();
          const swordPrim = json.meshes[json.nodes[sword].mesh].primitives[0];
          expect(swordPrim.attributes.COLOR_0).toBeDefined();
          for (const p of prims) {
            const pos = json.accessors[p.attributes.POSITION];
            expect(pos.componentType).toBe(5122);
            expect(pos.normalized).toBe(true);
          }
          expect(json.extensionsRequired).toEqual(expect.arrayContaining(['KHR_mesh_quantization', 'EXT_texture_webp']));
          // base colour + metal/roughness (gold catches the env map); normals on the full model only
          const body = json.materials[textured[0].material];
          expect(body.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
          expect(body.pbrMetallicRoughness.metallicFactor).toBe(1);
          expect(!!body.normalTexture).toBe(detail === 'full');
          expect(json.images).toHaveLength(detail === 'full' ? 3 : 2);
          for (const im of json.images) expect(im.mimeType).toBe('image/webp');
        });
      }
      continue;
    }
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

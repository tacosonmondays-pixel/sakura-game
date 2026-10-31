// Tripo batch 1 (docs/art/tripo/batch-1.md): the Gate Response Brigade's own enemy models
// (public/models/enemies/tripo, tools/tripo/build_tripo_enemy.py) and the textured props the staff layer draws
// (public/models/props/<id>.glb, tools/tripo/build_tripo_prop.py). Checked without WebGL from the GLB JSON.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRIPO_ENEMIES, tripoEnemyKey } from '../../src/models/glbEnemy.js';
import { TRIPO_PROPS } from '../../src/render/tripoProps.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { readGlbHeader } from './glbHeader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const enemyDir = path.join(here, '..', '..', 'public', 'models', 'enemies', 'tripo');
const propDir = path.join(here, '..', '..', 'public', 'models', 'props');
const ENEMY_CLIPS = ['death', 'hit', 'idle', 'move', 'special'];
const CLIP_CAP = { move: 1.2, idle: 1.6, hit: 0.35, death: 0.85, special: 0.65 };
const MAX_ENEMY = { normal: 240 * 1024, elite: 400 * 1024 };
const MAX_TRIS = { normal: 5000, elite: 8000 };

function packed(json) {
  expect(json.extensionsRequired).toEqual(expect.arrayContaining(['KHR_mesh_quantization', 'EXT_texture_webp']));
  // no meshopt / Draco: the game has no decoder for them
  expect(json.extensionsRequired.some((e) => /meshopt|draco/i.test(e))).toBe(false);
  for (const im of json.images) expect(im.mimeType).toBe('image/webp');
  const prims = json.meshes.flatMap((m) => m.primitives);
  expect(prims).toHaveLength(1);
  expect(json.materials[prims[0].material].pbrMetallicRoughness.baseColorTexture).toBeDefined();
  expect(json.accessors[prims[0].attributes.POSITION].componentType).toBe(5122);
  return prims[0];
}

describe('Tripo enemies', () => {
  const manifest = JSON.parse(readFileSync(path.join(enemyDir, 'manifest.json'), 'utf8'));

  it('lists exactly the runtime\'s Tripo enemies, all real Brigade defs', () => {
    expect(Object.keys(manifest).sort()).toEqual([...TRIPO_ENEMIES].sort());
    for (const id of TRIPO_ENEMIES) {
      expect(ENEMY_MAP[id]?.family, id).toBe('brigade');
      expect(tripoEnemyKey(ENEMY_MAP[id])).toBe(`tripo/${id}`);
    }
    expect(tripoEnemyKey(ENEMY_MAP.slime_basic || { id: 'slime_basic' })).toBeNull();
  });

  for (const id of TRIPO_ENEMIES) {
    it(`${id}: textured skinned mesh, the five clips, inside its budget`, () => {
      const file = path.join(enemyDir, `${id}.glb`);
      expect(existsSync(file), file).toBe(true);
      const tier = ENEMY_MAP[id].tier === 'elite' ? 'elite' : 'normal';
      expect(statSync(file).size).toBeLessThanOrEqual(MAX_ENEMY[tier]);
      const { json, binLength } = readGlbHeader(file);
      expect(json.buffers[0].byteLength).toBeLessThanOrEqual(binLength);
      expect(json.asset.extras).toMatchObject({ id, source: 'tripo', style: 'textured' });
      expect(json.asset.extras.height).toBeGreaterThan(0);
      expect(json.asset.extras.unitScale).toBeGreaterThan(0);
      const prim = packed(json);
      expect(prim.attributes.JOINTS_0).toBeDefined();
      expect(json.accessors[prim.indices].count / 3).toBeLessThanOrEqual(MAX_TRIS[tier]);
      expect(json.skins).toHaveLength(1);
      const joints = json.skins[0].joints.map((j) => json.nodes[j].name);
      expect(joints).toContain('root');
      expect(json.animations.map((a) => a.name).sort()).toEqual(ENEMY_CLIPS);
      for (const a of json.animations) {
        expect(a.channels.length, a.name).toBeGreaterThan(0);
        const dur = Math.max(...a.samplers.map((s) => json.accessors[s.input].max[0]));
        expect(dur, `${id} ${a.name}`).toBeLessThanOrEqual(CLIP_CAP[a.name]);
      }
      expect(manifest[id]).toMatchObject({ file: `${id}.glb`, size: statSync(file).size, source: 'tripo' });
    });
  }
});

describe('Tripo props', () => {
  const BUDGET = { big_yellow: { bytes: 240 * 1024, tris: 6000 }, norika_barricade: { bytes: 64 * 1024, tris: 800 }, suzu_bell: { bytes: 64 * 1024, tris: 800 } };
  it('the staff layer loads exactly these', () => {
    expect([...TRIPO_PROPS].sort()).toEqual(Object.keys(BUDGET).sort());
  });
  for (const id of TRIPO_PROPS) {
    it(`${id}: one textured static mesh, floor origin, inside its budget`, () => {
      const file = path.join(propDir, `${id}.glb`);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(BUDGET[id].bytes);
      const { json } = readGlbHeader(file);
      expect(json.asset.extras).toMatchObject({ id, source: 'tripo', style: 'textured-prop' });
      const prim = packed(json);
      expect(json.accessors[prim.indices].count / 3).toBeLessThanOrEqual(BUDGET[id].tris);
      expect(json.skins || []).toHaveLength(0);
      expect(json.animations || []).toHaveLength(0);
      const pos = json.accessors[prim.attributes.POSITION];
      expect(Math.abs(pos.min[1])).toBeLessThanOrEqual(330); // floor at y = 0 (normalised int16 units, 1%)
      expect(json.asset.extras.height).toBeGreaterThan(0.3);
      expect(json.asset.extras.height).toBeLessThan(0.8);
    });
  }
});

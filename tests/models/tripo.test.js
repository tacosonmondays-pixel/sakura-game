// Tripo batch 1 (docs/art/tripo/batch-1.md): the Gate Response Brigade's own enemy models
// (public/models/enemies/tripo, tools/tripo/build_tripo_enemy.py) and the textured props the staff layer draws
// (public/models/props/<id>.glb, tools/tripo/build_tripo_prop.py). Checked without WebGL from the GLB JSON.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRIPO_ENEMIES, TRIPO_ENEMY_LODS, tripoEnemyKey, enemyModelKeys, setEnemyDetail, getEnemyDetail } from '../../src/models/glbEnemy.js';
import { TRIPO_LANDMARKS, landmarkKey, swapLandmark } from '../../src/render/tripoLandmarks.js';
import { hasProp } from '../../src/render/props.js';
import { dragonHeadGeometry } from '../../src/render/rosterFx.js';
import { TRIPO_PROPS } from '../../src/render/tripoProps.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { readGlbHeader } from './glbHeader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const enemyDir = path.join(here, '..', '..', 'public', 'models', 'enemies', 'tripo');
const propDir = path.join(here, '..', '..', 'public', 'models', 'props');
const ENEMY_CLIPS = ['death', 'hit', 'idle', 'move', 'special'];
const CLIP_CAP = { move: 1.2, idle: 1.6, hit: 0.35, death: 0.85, special: 0.65 };
// budgets by tier (docs/art/ASSET_WISHLIST.md export sheet): normal 5k / 512², elite 8k / 1024², boss 12k and
// titan 20k / 1024² (the bosses and titans share the 'boss' tier in the data)
const MAX_ENEMY = { normal: 320 * 1024, elite: 400 * 1024, miniboss: 640 * 1024, boss: 1024 * 1024 };
const MAX_TRIS = { normal: 5000, elite: 8000, miniboss: 12000, boss: 20000 };

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

  it('lists exactly the runtime\'s Tripo enemies, all real defs: the Brigade, one per family, bosses and titans', () => {
    expect(Object.keys(manifest).sort()).toEqual([...TRIPO_ENEMIES].sort());
    for (const id of TRIPO_ENEMIES) {
      expect(ENEMY_MAP[id], id).toBeTruthy();
      expect(tripoEnemyKey(ENEMY_MAP[id])).toBe(`tripo/${id}`);
      // the preloads ask for the family mesh (the fallback) and the enemy's own model
      expect(enemyModelKeys(ENEMY_MAP[id])).toEqual([ENEMY_MAP[id].model?.base || ENEMY_MAP[id].family, `tripo/${id}`]);
    }
    // every family has at least one (batch 2: one enemy per family)
    const families = new Set(TRIPO_ENEMIES.map((id) => ENEMY_MAP[id].family));
    for (const f of new Set(Object.values(ENEMY_MAP).map((d) => d.family))) expect(families.has(f), f).toBe(true);
    expect(tripoEnemyKey(ENEMY_MAP.slime_gold)).toBeNull();
  });

  for (const id of TRIPO_ENEMIES) {
    it(`${id}: textured skinned mesh, the five clips, inside its budget`, () => {
      const file = path.join(enemyDir, `${id}.glb`);
      expect(existsSync(file), file).toBe(true);
      const tier = ENEMY_MAP[id].tier || 'normal';
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

describe('Tripo enemy LODs (medium / low quality)', () => {
  const manifest = JSON.parse(readFileSync(path.join(enemyDir, 'manifest.json'), 'utf8'));
  it('the family enemies ship a ~2k-triangle file; the keys switch with the detail level', () => {
    expect(TRIPO_ENEMY_LODS.length).toBe(12);
    for (const id of TRIPO_ENEMY_LODS) {
      expect(TRIPO_ENEMIES).toContain(id);
      const file = path.join(enemyDir, `${id}.lod.glb`);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(160 * 1024);
      const { json } = readGlbHeader(file);
      expect(json.asset.extras).toMatchObject({ id, source: 'tripo', style: 'textured', lod: true });
      const prim = packed(json);
      expect(json.accessors[prim.indices].count / 3).toBeLessThanOrEqual(2000);
      expect(json.animations.map((a) => a.name).sort()).toEqual(ENEMY_CLIPS);
      expect(manifest[id]).toMatchObject({ lod: `${id}.lod.glb`, lodSize: statSync(file).size });
      expect(tripoEnemyKey(ENEMY_MAP[id], 'lod')).toBe(`tripo/${id}.lod`);
      expect(tripoEnemyKey(ENEMY_MAP[id], 'full')).toBe(`tripo/${id}`);
    }
    // bosses and titans keep one file at every quality
    expect(tripoEnemyKey(ENEMY_MAP.dragon_ashwing, 'lod')).toBe('tripo/dragon_ashwing');
    // the module default follows setEnemyDetail (the battle sets it from the graphics quality)
    const before = getEnemyDetail();
    setEnemyDetail('lod');
    expect(enemyModelKeys(ENEMY_MAP.slime_green)).toEqual(['slime', 'tripo/slime_green.lod']);
    setEnemyDetail('full');
    expect(enemyModelKeys(ENEMY_MAP.slime_green)).toEqual(['slime', 'tripo/slime_green']);
    setEnemyDetail(before);
  });
});

describe('Tripo props', () => {
  const BUDGET = {
    big_yellow: { bytes: 240 * 1024, tris: 6000 },
    norika_barricade: { bytes: 64 * 1024, tris: 800 },
    suzu_bell: { bytes: 64 * 1024, tris: 800 },
    norika_hold_line: { bytes: 64 * 1024, tris: 800 },
    // hung on the dragon's moving head bead: origin at its centre, not on the floor
    seiran_dragon_head: { bytes: 200 * 1024, tris: 3000, centre: true },
  };
  it('the staff layer loads exactly these', () => {
    expect([...TRIPO_PROPS].sort()).toEqual(Object.keys(BUDGET).sort());
  });
  for (const id of TRIPO_PROPS) {
    it(`${id}: one textured static mesh, ${BUDGET[id].centre ? 'centred' : 'floor'} origin, inside its budget`, () => {
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
      if (BUDGET[id].centre) expect(Math.abs(pos.min[1] + pos.max[1])).toBeLessThanOrEqual(660); // centred (1 %)
      else expect(Math.abs(pos.min[1])).toBeLessThanOrEqual(330); // floor at y = 0 (normalised int16 units, 1%)
      expect(json.asset.extras.height).toBeGreaterThan(0.3);
      expect(json.asset.extras.height).toBeLessThan(0.8);
    });
  }
});

describe('the sky dragon head', () => {
  it('is as tall as the procedural head it replaces (not ~1.4× its size), centred on the head bead', () => {
    const g = dragonHeadGeometry();
    g.computeBoundingBox();
    const procH = g.boundingBox.max.y - g.boundingBox.min.y;
    const { json } = readGlbHeader(path.join(propDir, 'seiran_dragon_head.glb'));
    const pos = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
    const k = 1 / 32767;
    const h = (pos.max[1] - pos.min[1]) * k;
    expect(h / procH).toBeGreaterThan(0.9);
    expect(h / procH).toBeLessThan(1.1);
    for (const i of [0, 1, 2]) expect(Math.abs(pos.max[i] + pos.min[i]) * k).toBeLessThan(0.02); // centred
  });
});

describe('Tripo story landmarks', () => {
  const dir = path.join(propDir, 'landmarks');
  it('every landmark the terrain swaps has its file, and only those ship', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)).sort();
    expect(files).toEqual(Object.keys(TRIPO_LANDMARKS).sort());
    for (const t of files) expect(hasProp(t), t).toBe(true);
  });

  it('landmarkKey: only listed pieces (and listed variants), only where a model can load', () => {
    expect(landmarkKey('clockTower', 0, true)).toBe('landmarks/clockTower');
    expect(landmarkKey('schoolBlock', 0, true)).toBe('landmarks/schoolBlock');
    expect(landmarkKey('schoolBlock', 2, true)).toBeNull();
    expect(landmarkKey('hammerTear', 0, true)).toBeNull();
    expect(landmarkKey('rock', 0, true)).toBeNull();
    expect(landmarkKey('clockTower', 0, false)).toBeNull();
    expect(landmarkKey('clockTower')).toBeNull(); // node: no loader, the map is built exactly as before
  });

  for (const t of Object.keys(TRIPO_LANDMARKS)) {
    it(`${t}: one textured static mesh on the floor, ≤ 6k triangles, ≤ 420 KB`, () => {
      const file = path.join(dir, `${t}.glb`);
      expect(statSync(file).size).toBeLessThanOrEqual(420 * 1024);
      const { json } = readGlbHeader(file);
      expect(json.asset.extras).toMatchObject({ id: `lm_${t}`, source: 'tripo', style: 'textured-prop' });
      const prim = packed(json);
      expect(json.accessors[prim.indices].count / 3).toBeLessThanOrEqual(6000);
      expect(json.skins || []).toHaveLength(0);
    });
  }

  it('swapLandmark fits the model into the procedural piece and hides it', () => {
    const group = new THREE.Group();
    const proc = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1).translate(0, 1, 0), new THREE.MeshBasicMaterial());
    group.add(proc);
    const prop = { geometry: new THREE.BoxGeometry(0.5, 0.5, 0.5).translate(0, 0.25, 0), material: new THREE.MeshBasicMaterial() };
    const m = swapLandmark(group, prop);
    expect(proc.visible).toBe(false);
    expect(m.parent).toBe(group);
    const box = new THREE.Box3().setFromObject(m);
    expect(box.min.y).toBeCloseTo(0, 5);
    // as tall as the piece unless that would be wider than its footprint (× 1.1)
    expect(box.max.y).toBeCloseTo(0.5 * Math.min(2 / 0.5, 1.1 / 0.5), 5);
    expect(swapLandmark(group, prop)).toBe(m); // once
  });

  it('swapLandmark keeps the glow meshes lit and leaves them out of the fit', () => {
    const group = new THREE.Group();
    const proc = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1).translate(0, 1, 0), new THREE.MeshBasicMaterial());
    // a lamp glow far above the piece: if it counted, the model would come out taller
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1).translate(0, 5, 0), new THREE.MeshBasicMaterial());
    glow.userData.glow = true;
    group.add(proc, glow);
    const prop = { geometry: new THREE.BoxGeometry(0.5, 0.5, 0.5).translate(0, 0.25, 0), material: new THREE.MeshBasicMaterial() };
    const m = swapLandmark(group, prop);
    expect(proc.visible).toBe(false);
    expect(glow.visible).toBe(true);
    const box = new THREE.Box3().setFromObject(m);
    expect(box.max.y).toBeCloseTo(0.5 * Math.min(2 / 0.5, 1.1 / 0.5), 5);
  });
});

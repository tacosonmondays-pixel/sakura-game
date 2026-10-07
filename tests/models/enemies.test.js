// Checks the generated enemy family GLBs (public/models/enemies) without WebGL: parses each
// GLB header in node and verifies every family ships the clips, rig, materials, face atlas and
// piece names the runtime relies on, that every EnemyDef resolves to a built family (variant +
// props present in that family's file) and that the whole set stays inside the size budget.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENEMIES, FAMILIES, FAMILY_ORDER } from '../../src/data/enemies.js';
import { parsePieceName, ENEMY_FACE_CELLS } from '../../src/models/glbEnemy.js';
import { readGlbHeader } from './glbHeader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', '..', 'public', 'models', 'enemies');

const REQUIRED_CLIPS = ['move', 'idle', 'hit', 'death', 'special'];
const MAX_FAMILY_BYTES = 320 * 1024;
const MAX_TOTAL_BYTES = 2_500_000;

const manifest = existsSync(path.join(dir, 'manifest.json')) ? JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) : null;

/** Piece names ("<vis>|<group>|<material>") of every mesh node in a family GLB. */
function pieces(json) {
  return json.nodes.filter((n) => n.mesh !== undefined).map((n) => parsePieceName(n.name));
}

describe('enemy family GLBs', () => {
  it('has a manifest listing every family of the bestiary', () => {
    expect(manifest).toBeTruthy();
    expect(Object.keys(FAMILIES).sort()).toEqual([...FAMILY_ORDER].sort());
    for (const fam of FAMILY_ORDER) {
      expect(manifest[fam], fam).toBeTruthy();
      expect(manifest[fam].file).toBe(`${fam}.glb`);
      for (const c of REQUIRED_CLIPS) expect(manifest[fam].animations, `${fam} ${c}`).toContain(c);
      expect(manifest[fam].unitScale).toBe(2);
      expect(manifest[fam].height).toBeGreaterThan(0.5);
    }
  });

  for (const fam of FAMILY_ORDER) {
    it(`${fam}: valid GLB with clips, rig, tinted body + glow materials, face atlas`, () => {
      const file = path.join(dir, `${fam}.glb`);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(MAX_FAMILY_BYTES);
      const { json, binLength } = readGlbHeader(file);
      expect(binLength).toBeGreaterThan(0);
      expect(json.buffers[0].byteLength).toBeLessThanOrEqual(binLength);
      // extras written by tools/blender/enemies/build_enemies.py
      const x = json.asset.extras;
      expect(x.family).toBe(fam);
      expect(x.unitScale).toBe(2);
      expect(x.faceCells).toEqual(ENEMY_FACE_CELLS);
      expect(x.faceGrid).toEqual([3, 2]);
      expect(x.faceCorner).toHaveLength(2);
      expect(typeof x.variants).toBe('object');
      // clips: every required one, bezier (CUBICSPLINE) keys — the exporter writes a channel
      // that only holds a constant (e.g. a one-key scale) as STEP — and every channel targets a bone
      const names = json.animations.map((a) => a.name);
      for (const c of REQUIRED_CLIPS) expect(names, `${fam} ${c}`).toContain(c);
      const joints = new Set(json.skins[0].joints);
      for (const a of json.animations) {
        expect(a.channels.length).toBeGreaterThan(0);
        for (const s of a.samplers) expect(['CUBICSPLINE', 'STEP']).toContain(s.interpolation);
        expect(a.samplers.some((s) => s.interpolation === 'CUBICSPLINE'), `${fam} ${a.name} is bezier`).toBe(true);
        for (const ch of a.channels) expect(joints.has(ch.target.node), `${fam} ${a.name} animates a bone`).toBe(true);
      }
      // rig: one skin, a root bone, every mesh skinned
      expect(json.skins).toHaveLength(1);
      const jointNames = json.skins[0].joints.map((j) => json.nodes[j].name);
      expect(jointNames).toContain('root');
      const prims = json.meshes.flatMap((m) => m.primitives);
      expect(prims.length).toBeGreaterThan(0);
      for (const p of prims) {
        const attrs = p.attributes;
        expect(attrs.POSITION).toBeDefined();
        expect(attrs.COLOR_0).toBeDefined(); // tint roles live in the colour alpha
        expect(attrs.JOINTS_0).toBeDefined();
        expect(attrs.WEIGHTS_0).toBeDefined();
        expect(attrs.NORMAL, 'normals are rebuilt at load').toBeUndefined();
        const pos = json.accessors[attrs.POSITION];
        expect(pos.componentType).toBe(5122); // int16, KHR_mesh_quantization
        expect(pos.normalized).toBe(true);
        const col = json.accessors[attrs.COLOR_0];
        expect(col.type).toBe('VEC4');
      }
      expect(json.extensionsRequired).toContain('KHR_mesh_quantization');
      // materials + the one embedded face atlas
      const mats = json.materials.map((m) => m.name);
      expect(mats).toContain('body');
      expect(json.images).toHaveLength(1);
      expect(json.images[0].mimeType).toBe('image/png');
      const body = json.materials.find((m) => m.name === 'body');
      expect(body.pbrMetallicRoughness.baseColorTexture).toBeDefined();
      // piece names: a base body plus the props / variants the manifest promises
      const ps = pieces(json);
      expect(ps.some((p) => p.vis === 'base'), `${fam} has base pieces`).toBe(true);
      for (const p of ps) expect(['body', 'glow']).toContain(p.material);
      const famDefs = ENEMIES.filter((e) => e.model.base === fam);
      const hasFace = ps.some((p) => p.vis === 'base' && p.material === 'body');
      expect(hasFace).toBe(true);
      expect(famDefs.length).toBeGreaterThan(0);
    });
  }

  it('every EnemyDef resolves to a built family with its variant and props available', () => {
    for (const e of ENEMIES) {
      const fam = e.model.base;
      expect(FAMILIES[fam], `${e.id} family ${fam}`).toBeTruthy();
      expect(e.family).toBe(fam);
      const m = manifest[fam];
      expect(m, `${e.id} family GLB ${fam}`).toBeTruthy();
      expect(m.variants, `${e.id} variant ${e.model.variant}`).toContain(e.model.variant);
      for (const p of e.model.props) expect(m.props, `${e.id} prop ${p}`).toContain(p);
    }
  });

  it('variant pieces and hide tables match the defs that use them', () => {
    for (const fam of FAMILY_ORDER) {
      const { json } = readGlbHeader(path.join(dir, `${fam}.glb`));
      const ps = pieces(json);
      const varPieces = new Set(ps.filter((p) => p.vis.startsWith('var:')).map((p) => p.vis.slice(4)));
      const groups = new Set(ps.filter((p) => p.vis === 'base').map((p) => p.group));
      const table = json.asset.extras.variants || {};
      for (const [variant, info] of Object.entries(table)) {
        expect(ENEMIES.some((e) => e.model.base === fam && e.model.variant === variant), `${fam} variant ${variant} is used`).toBe(true);
        for (const g of info.hide || []) expect(groups, `${fam} ${variant} hides a real group ${g}`).toContain(g);
      }
      for (const v of varPieces) expect(ENEMIES.some((e) => e.model.base === fam && e.model.variant === v), `${fam} var:${v} is used`).toBe(true);
    }
  });

  it('keeps the whole set under the budget', () => {
    let total = 0;
    for (const fam of FAMILY_ORDER) total += statSync(path.join(dir, `${fam}.glb`)).size;
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
    for (const fam of FAMILY_ORDER) expect(manifest[fam].size).toBe(statSync(path.join(dir, `${fam}.glb`)).size);
  });
});

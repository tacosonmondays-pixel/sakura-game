// The duo unit Kohaku & Tsubaki (Prism Battery, docs/specs/DUO_LR.md §1.6) shows two imported Meshy chibis on one
// base (src/models/duo.js). They are model assets, not roster units, so the per-unit checks of
// tests/models/glb.test.js (which walk UNITS) do not see them: this checks their two GLBs the same way, minus the
// sword (both girls are built with empty hands; their gear is part of the mesh,
// tools/art/src/meshy-oct20/DUO_READY.md), and that nothing resolves the duo to a `kohaku_tsubaki.glb`.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlbHeader } from './glbHeader.js';
import { UNITS, getUnit } from '../../src/data/units.js';
import { modelIds, duoMemberAssets, DUO_MEMBERS } from '../../src/models/duo.js';
import { resolveSkin } from '../../src/data/skins.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', '..', 'public', 'models', 'characters');
const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

/** Each member: her attack clip, her FX anchor and the bone it rides on, her eye guard's hue window. */
const MEMBERS = {
  kohaku: { attack: 'attack_beam', anchor: 'beam', bone: 'chest', guard: [26, 47] },
  tsubaki: { attack: 'attack_mortar', anchor: 'muzzle', bone: 'head', guard: [221, 250] },
};
/** The game skeleton of the imported figures (25 joints: the renamed Meshy humanoid + a floor root). */
const BONES = [
  'root', 'hips', 'spine', 'spine1', 'chest', 'neck', 'head', 'head_end', 'head_front',
  'shoulder_L', 'upper_arm_L', 'forearm_L', 'hand_L', 'shoulder_R', 'upper_arm_R', 'forearm_R', 'hand_R',
  'thigh_L', 'shin_L', 'foot_L', 'toe_L', 'thigh_R', 'shin_R', 'foot_R', 'toe_R',
];
const MAX_FULL = 2.5 * 1024 * 1024;
const MAX_LOD = 1.25 * 1024 * 1024;
const DUO = getUnit('kohaku_tsubaki');

/** Vertex and triangle counts of a GLB's meshes. */
function counts(json) {
  let vertices = 0;
  let triangles = 0;
  for (const m of json.meshes) {
    for (const p of m.primitives) {
      vertices += json.accessors[p.attributes.POSITION].count;
      triangles += json.accessors[p.indices].count / 3;
    }
  }
  return { vertices, triangles };
}

describe('duo member GLBs (Kohaku & Tsubaki)', () => {
  it('the duo unit lists exactly these two members', () => {
    expect(DUO.duo.members.slice().sort()).toEqual(Object.keys(MEMBERS).sort());
    for (const id of Object.keys(MEMBERS)) expect(DUO_MEMBERS[id], id).toBeTruthy();
  });

  for (const [id, m] of Object.entries(MEMBERS)) {
    it(`${id}: a model-asset manifest entry (not a unit) whose sizes and counts match the files`, () => {
      const e = manifest[id];
      expect(e).toMatchObject({ file: `${id}.glb`, lod: `${id}.lod.glb`, source: 'meshy', duoMember: 'kohaku_tsubaki' });
      expect(e.testBuild).toBeUndefined();
      expect(UNITS.some((u) => u.id === id), `${id} is not a roster unit`).toBe(false);
      expect(e.animations.slice().sort()).toEqual([m.attack, 'cheer', 'hurt', 'idle', 'walk'].sort());
      expect(e.size).toBe(statSync(path.join(dir, e.file)).size);
      expect(e.lodSize).toBe(statSync(path.join(dir, e.lod)).size);
      const full = counts(readGlbHeader(path.join(dir, e.file)).json);
      const lod = counts(readGlbHeader(path.join(dir, e.lod)).json);
      expect([e.vertices, e.triangles]).toEqual([full.vertices, full.triangles]);
      expect([e.lodVertices, e.lodTriangles]).toEqual([lod.vertices, lod.triangles]);
      expect(e.lodSize).toBeLessThan(e.size * 0.65);
    });

    for (const detail of ['full', 'lod']) {
      it(`${id} ${detail}: textured figure, 25-bone rig, five clips, eyes with her guard, gear anchor`, () => {
        const file = path.join(dir, `${id}${detail === 'lod' ? '.lod' : ''}.glb`);
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size).toBeLessThanOrEqual(detail === 'lod' ? MAX_LOD : MAX_FULL);
        const { json, binLength } = readGlbHeader(file);
        expect(json.buffers[0].byteLength).toBeLessThanOrEqual(binLength);
        const ex = json.asset.extras;
        expect(ex).toMatchObject({ unit: id, source: 'meshy', style: 'textured', lod: detail === 'lod', duo: 'kohaku_tsubaki' });
        expect(ex.height).toBeCloseTo(1.224, 3);
        expect(ex.unitScale).toBeGreaterThan(0);
        // the five clips, each within its length
        const names = json.animations.map((a) => a.name);
        expect(names.slice().sort()).toEqual([m.attack, 'cheer', 'hurt', 'idle', 'walk'].sort());
        for (const a of json.animations) {
          const dur = Math.max(...a.samplers.map((s) => json.accessors[s.input].max[0]));
          const cap = { idle: 1.6, cheer: 1.2, hurt: 0.4, walk: 1.2 }[a.name] ?? 0.6;
          expect(dur, `${a.name} length`).toBeGreaterThan(0.2);
          expect(dur, `${a.name} length`).toBeLessThanOrEqual(cap + 1e-3);
        }
        // the game skeleton: one skin, 25 joints
        expect(json.skins).toHaveLength(1);
        const joints = json.skins[0].joints.map((j) => json.nodes[j].name);
        expect(joints).toHaveLength(25);
        expect(joints.slice().sort()).toEqual(BONES.slice().sort());
        // one textured, skinned body (WebP, normals only on the full model)
        const prims = json.meshes.flatMap((x) => x.primitives);
        expect(prims).toHaveLength(1);
        expect(prims[0].attributes.JOINTS_0).toBeDefined();
        const body = json.materials[prims[0].material];
        expect(body.pbrMetallicRoughness.baseColorTexture).toBeDefined();
        expect(body.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
        expect(!!body.normalTexture).toBe(detail === 'full');
        for (const im of json.images) expect(im.mimeType).toBe('image/webp');
        expect(json.extensionsRequired).toEqual(expect.arrayContaining(['KHR_mesh_quantization', 'EXT_texture_webp']));
        // painted eyes: a mirrored pair on the face (src/models/figurine.js), plus her own colour guard
        const top = json.accessors[prims[0].attributes.POSITION].max[1] / 32767;
        expect(ex.eyes.centers).toHaveLength(2);
        const [er, el] = ex.eyes.centers;
        expect(er[0]).toBeLessThan(0);
        expect(Math.abs(er[0] + el[0])).toBeLessThan(0.01);
        expect(Math.abs(er[1] - el[1])).toBeLessThan(0.01);
        for (const c of ex.eyes.centers) {
          expect(c[1]).toBeGreaterThan(top * 0.55);
          expect(c[1]).toBeLessThan(top * 0.85);
          expect(c[2]).toBeGreaterThan(0);
        }
        expect(ex.eyes.radii).toHaveLength(2);
        const g = ex.eyes.hairGuard;
        expect(g.hue[0]).toBeLessThan(g.hue[1]);
        expect(g.hue[0]).toBeGreaterThanOrEqual(m.guard[0] - 1);
        expect(g.hue[1]).toBeLessThanOrEqual(m.guard[1] + 1);
        expect(typeof g.sat).toBe('number');
        // a closed-eye fill morph, when named, exists on the body (Tsubaki's 'eyesClosed')
        if (ex.eyes.closedTarget) {
          expect(json.meshes[0].extras.targetNames).toContain(ex.eyes.closedTarget);
          expect(prims[0].targets).toHaveLength(json.meshes[0].extras.targetNames.length);
        }
        // FX anchor: Kohaku's prism lens on her chest, Tsubaki's mortar muzzle on her head
        const anchor = ex.anchors[m.anchor];
        expect(anchor, m.anchor).toBeTruthy();
        expect(anchor.bone).toBe(m.bone);
        expect(joints).toContain(anchor.bone);
        expect(anchor.pos).toHaveLength(3);
        expect(anchor.dir).toHaveLength(3);
        expect(Math.hypot(...anchor.dir)).toBeCloseTo(1, 2);
        expect(DUO_MEMBERS[id].anchor.key).toBe(m.anchor);
      });
    }
  }
});

describe('nothing resolves the duo to a missing file', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('the duo has no file or entry of her own; her model ids are her members\' files', () => {
    expect(manifest.kohaku_tsubaki).toBeUndefined();
    expect(existsSync(path.join(dir, 'kohaku_tsubaki.glb'))).toBe(false);
    expect(modelIds(DUO)).toEqual(['kohaku', 'tsubaki']);
    expect(duoMemberAssets('kohaku_tsubaki')).toEqual(['kohaku', 'tsubaki']);
    expect(duoMemberAssets(resolveSkin(DUO.id).asset)).toEqual(['kohaku', 'tsubaki']);
    expect(duoMemberAssets('aoi')).toBeNull();
    for (const u of UNITS.filter((x) => x.duo)) {
      for (const id of modelIds(u)) {
        expect(manifest[id], `${u.id} -> ${id}`).toBeTruthy();
        expect(existsSync(path.join(dir, manifest[id].file)), manifest[id].file).toBe(true);
        expect(existsSync(path.join(dir, manifest[id].lod)), manifest[id].lod).toBe(true);
      }
    }
  });

  it('preloadModels, buildChibi and loadCharacter only ever ask for the members\' files', async () => {
    const urls = [];
    const text = readFileSync(path.join(dir, 'manifest.json'), 'utf8');
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('document', {});
    vi.stubGlobal('Request', class {
      constructor(url) { this.url = String(url); }
    });
    vi.stubGlobal('fetch', async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      urls.push(url);
      if (url.endsWith('manifest.json')) return new Response(text, { status: 200 });
      return new Response('', { status: 404 });
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.resetModules();
    const models = await import('../../src/models/index.js');
    const glb = await import('../../src/models/glbChibi.js');
    const { getUnit: get } = await import('../../src/data/units.js');
    const duo = get('kohaku_tsubaki');
    await models.preloadModels([duo.id], { detail: 'full' });
    await models.preloadModels([duo.id], { detail: 'lod' });
    expect(await glb.loadCharacter('kohaku_tsubaki', 'full')).toBeNull();
    const fig = models.buildChibi(duo, { quality: 'medium' });
    expect(fig.userData.duo).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    const files = urls.map((u) => u.split('/').pop());
    expect(files.some((f) => f.startsWith('kohaku_tsubaki')), files.join(' ')).toBe(false);
    for (const f of ['kohaku.glb', 'tsubaki.glb', 'kohaku.lod.glb', 'tsubaki.lod.glb']) expect(files, f).toContain(f);
    // her GLBs failed to load (404 here): both members stay procedural for good
    expect(fig.userData.isStandIn()).toBe(true);
    models.disposeObject(fig);
  });
});

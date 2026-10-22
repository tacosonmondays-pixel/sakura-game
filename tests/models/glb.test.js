// Checks the generated character GLBs (public/models/characters) without WebGL: parses the
// GLB JSON header in node and verifies every unit ships the actions, bones, materials and
// face atlas the runtime relies on, within the size budget. The stand-ins (src/models/standins.js:
// the returning girls without approved art) are procedural on purpose: they must NOT ship a GLB or
// a manifest entry (tests/models/standins.test.js checks they build procedurally instead).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNITS } from '../../src/data/units.js';
import { STANDIN_UNITS, isStandIn } from '../../src/models/standins.js';
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
// imported Meshy figures (tools/meshy/build_meshy_chibi.py): painted texture + sword, phone-packed. Tightened on
// purpose with the lively rebuild (tools/blender/lively/slim.py): it added a flat texture and longer clips but
// trimmed the maps each detail level can spare, so the files stay near their old 1.2-1.33 MB / 0.56-0.61 MB.
const MAX_MESHY_FULL_BYTES = 1.4 * 1024 * 1024;
const MAX_MESHY_LOD_BYTES = 0.65 * 1024 * 1024;
const MESHY_CLIPS = ['idle', 'walk', 'cheer', 'hurt'];
// Clip-length caps for the imported figures, raised deliberately at rig rollout step 1 (the rig test's
// plan §6.5 and verdict §7): the old caps (idle 1.6 s, cheer 1.2, hurt 0.4, attack 0.6) only fit
// the short, stiff shipped loops; Noa's library clips are a 7.85 s breathing idle, a 1.85 s cheer, a
// 1.2 s hurt and a 10 s between-wave mood loop. The new caps still stop a 30 s mocap take or a
// looping full hit reaction from slipping in. A figure's old clip kept as `<name>_short` (the
// 'Lively figures: off' fallback) keeps the old cap.
const MESHY_CLIP_CAPS = { idle: 8, cheer: 4, victory: 4, hurt: 1.2, dizzy: 6, deploy: 2, walk: 1.2 };
const MESHY_OLD_CAPS = { idle: 1.6, cheer: 1.2, hurt: 0.4, walk: 1.2 };
const ATTACK_CAP = 1.2; // longer than the old 0.6 s: clipMarks[name].contact is required
const FIDGET_CAP = 5; // anything else; a loop marked clipMarks[name].mood (between waves): 10 s

/** The BIN chunk of a GLB and a reader for its (packed: int8/uint8/int16/uint16/float) accessors. */
function readGlbBin(file) {
  const buf = readFileSync(file);
  let off = 12;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x004e4942) return buf.subarray(off + 8, off + 8 + len);
    off += 8 + len;
  }
  return null;
}
function readAccessor(json, bin, idx) {
  const a = json.accessors[idx];
  const bv = json.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const size = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5126: 4 }[a.componentType];
  const stride = bv.byteStride || n * size;
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const read = {
    5120: (o) => bin.readInt8(o), 5121: (o) => bin.readUInt8(o), 5122: (o) => bin.readInt16LE(o),
    5123: (o) => bin.readUInt16LE(o), 5126: (o) => bin.readFloatLE(o),
  }[a.componentType];
  const max = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType];
  const out = [];
  for (let i = 0; i < a.count; i++) {
    const v = [];
    for (let k = 0; k < n; k++) {
      const x = read(base + i * stride + k * size);
      v.push(a.normalized ? x / max : x);
    }
    out.push(v);
  }
  return out;
}
const MESHY_BONES = [
  'root', 'hips', 'spine', 'chest', 'neck', 'head', 'upper_arm_L', 'forearm_L', 'hand_L', 'upper_arm_R', 'forearm_R', 'hand_R',
  'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R',
];

// every other unit must have a GLB; the count guards against quietly moving a girl to the stand-ins
const GLB_UNITS = UNITS.filter((u) => !isStandIn(u.id));
const GLB_UNIT_COUNT = 35; // + noa, hana, ruri (Meshy, art wave), fuu, iroha, ena, kanna, yoriko, seiran (temporary Blender chibis), the seven new girls (UNIT_GAPS §5)

const manifest = existsSync(path.join(dir, 'manifest.json')) ? JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) : null;

describe('character GLBs', () => {
  it('has a manifest listing every unit that is not a stand-in', () => {
    expect(manifest).toBeTruthy();
    expect(GLB_UNITS).toHaveLength(GLB_UNIT_COUNT);
    for (const u of GLB_UNITS) {
      expect(manifest[u.id], u.id).toBeTruthy();
      expect(manifest[u.id].file).toBe(`${u.id}.glb`);
      expect(manifest[u.id].lod).toBe(`${u.id}.lod.glb`);
    }
  });

  it('stand-ins are roster units with no GLB file and no manifest entry', () => {
    for (const id of STANDIN_UNITS) {
      expect(UNITS.some((u) => u.id === id), id).toBe(true);
      expect(manifest[id], `${id}: has a manifest entry, remove it from STANDIN_UNITS`).toBeUndefined();
      expect(existsSync(path.join(dir, `${id}.glb`)), `${id}.glb exists, remove it from STANDIN_UNITS`).toBe(false);
    }
  });

  for (const u of GLB_UNITS) {
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
          expect(ex.height).toBeGreaterThan(1.2); // battle size: 1.224, ~1.25x the cage heroes (was 1.53, too big for the map)
          expect(ex.unitScale).toBeGreaterThan(0);
          const names = json.animations.map((a) => a.name);
          for (const c of MESHY_CLIPS) expect(names, `${u.id} ${c}`).toContain(c);
          expect(names.some((n) => n.startsWith('attack_')), `${u.id} attack clip`).toBe(true);
          for (const a of json.animations) {
            expect(a.channels.length).toBeGreaterThan(0);
            const dur = Math.max(...a.samplers.map((s) => json.accessors[s.input].max[0]));
            let cap;
            if (a.name.endsWith('_short')) cap = MESHY_OLD_CAPS[a.name.slice(0, -6)] ?? 2;
            else if (a.name.startsWith('attack_')) cap = ATTACK_CAP;
            else cap = MESHY_CLIP_CAPS[a.name] ?? (ex.clipMarks?.[a.name]?.mood ? 10 : FIDGET_CAP);
            expect(dur, `${a.name} length`).toBeLessThanOrEqual(cap + 1e-3);
            if (a.name.startsWith('attack_') && dur > 0.6 + 1e-3) expect(ex.clipMarks?.[a.name]?.contact, `${a.name} contact mark`).toBeGreaterThan(0);
          }
          // the lively layer's glance scale per clip (a clip that looks around by itself), within 0..1
          for (const [name, mk] of Object.entries(ex.clipMarks || {})) {
            expect(names, `clipMarks ${name}`).toContain(name);
            if (mk.glance !== undefined) {
              expect(mk.glance).toBeGreaterThanOrEqual(0);
              expect(mk.glance).toBeLessThanOrEqual(1);
            }
          }
          expect(json.skins).toHaveLength(1);
          const joints = json.skins[0].joints.map((j) => json.nodes[j].name);
          for (const b of MESHY_BONES) expect(joints, `${u.id} bone ${b}`).toContain(b);
          // a face skinned across neck + head (Hikari) names the bone the lively layer turns it from
          if (ex.faceBone) expect(joints, `${u.id} faceBone`).toContain(ex.faceBone);
          // a hand-held prop (Hikari's sword) hangs off the right hand; girls whose gear is part of
          // the body mesh (Noa's folded shield on her forearm) ship none
          const hand = json.nodes.findIndex((n) => n.name === 'hand_R');
          const sword = json.nodes.findIndex((n) => n.name === 'sword');
          if (ex.weaponKind === 'slash') expect(sword, `${u.id} sword`).toBeGreaterThanOrEqual(0);
          if (sword >= 0) expect(json.nodes[hand].children).toContain(sword);
          const prims = json.meshes.flatMap((m) => m.primitives);
          const textured = prims.filter((p) => json.materials[p.material].pbrMetallicRoughness?.baseColorTexture);
          expect(textured).toHaveLength(1);
          expect(textured[0].attributes.TEXCOORD_0).toBeDefined();
          expect(textured[0].attributes.JOINTS_0).toBeDefined();
          if (sword >= 0) expect(json.meshes[json.nodes[sword].mesh].primitives[0].attributes.COLOR_0).toBeDefined();
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
          // + the offline-flattened base colour for the clean cel look (extras.flat), when she has one
          expect(json.images).toHaveLength((detail === 'full' ? 3 : 2) + (ex.flat ? 1 : 0));
          for (const im of json.images) expect(im.mimeType).toBe('image/webp');
          if (ex.flat) {
            const tex = json.textures[ex.flat.texture];
            expect(tex, `${u.id} flat texture`).toBeDefined();
            const src = tex.extensions?.EXT_texture_webp?.source ?? tex.source;
            expect(json.images[src].name).toBe('flat');
            // not on a material: look B keeps her painted map, the cel look swaps the flat one in
            for (const m of json.materials) expect(m.pbrMetallicRoughness?.baseColorTexture?.index).not.toBe(ex.flat.texture);
            expect(ex.flat.palette.length).toBeGreaterThan(3);
            expect(ex.flat.palette.length).toBeLessThanOrEqual(16);
            for (const c of ex.flat.palette) expect(c).toMatch(/^#[0-9a-f]{6}$/);
            for (const k of ['skin', 'skinLow']) expect(ex.flat.eyes[k]).toMatch(/^#[0-9a-f]{6}$/);
          }
          // authored spring bones (PLAN §6.5): the names exist as joints under the right parent, and
          // their weights sit on that part only (buns: the back of the big head; ribbon: front of the chest)
          if (ex.springBones) {
            const bin = readGlbBin(file);
            const prim = textured[0];
            const P = readAccessor(json, bin, prim.attributes.POSITION);
            const J = readAccessor(json, bin, prim.attributes.JOINTS_0);
            const Wt = readAccessor(json, bin, prim.attributes.WEIGHTS_0);
            const topY = json.accessors[prim.attributes.POSITION].max[1] / 32767;
            const parentOf = (name) => json.nodes.find((n) => (n.children || []).some((c) => json.nodes[c].name === name))?.name;
            for (const b of ex.springBones) {
              expect(joints, `${u.id} spring bone ${b}`).toContain(b);
              const ji = joints.indexOf(b);
              const idx = [];
              for (let i = 0; i < P.length; i++) for (let k = 0; k < 4; k++) if (J[i][k] === ji && Wt[i][k] > 0.02) idx.push(i);
              expect(idx.length, `${b} weighted vertices`).toBeGreaterThan(20);
              if (/^bun/.test(b)) {
                expect(parentOf(b)).toBe('head');
                for (const i of idx) expect(P[i][1], `${b} vertex ${i}`).toBeGreaterThan(topY * 0.5);
              } else if (/^ribbon/.test(b)) {
                expect(parentOf(b)).toBe('chest');
                for (const i of idx) {
                  expect(P[i][1]).toBeGreaterThan(topY * 0.4);
                  expect(P[i][1]).toBeLessThan(topY * 0.6);
                  expect(P[i][2]).toBeGreaterThan(0);
                }
              }
            }
          }
          // her painted eyes, measured at build time so the shader can close them (blink, ^ ^, > <):
          // two mirrored boxes on the front of the head, in the stored position space
          const eyes = ex.eyes;
          expect(eyes?.centers).toHaveLength(2);
          const top = json.accessors[textured[0].attributes.POSITION].max[1] / 32767;
          const [er, el] = eyes.centers;
          expect(er[0]).toBeLessThan(0);
          expect(el[0]).toBeGreaterThan(0);
          expect(Math.abs(er[0] + el[0])).toBeLessThan(0.01);
          expect(Math.abs(er[1] - el[1])).toBeLessThan(0.01);
          for (const c of eyes.centers) {
            expect(c[1]).toBeGreaterThan(top * 0.55); // in the big chibi head
            expect(c[1]).toBeLessThan(top * 0.85);
            expect(c[2]).toBeGreaterThan(0); // on the face side (glTF +Z is her front)
          }
          for (const r of eyes.radii) {
            expect(r[0]).toBeGreaterThan(top * 0.02);
            expect(r[0]).toBeLessThan(top * 0.1);
            expect(r[1]).toBeGreaterThan(top * 0.02);
            expect(r[1]).toBeLessThan(top * 0.1);
          }
          for (const k of ['skin', 'skinLow', 'lash']) expect(eyes[k]).toMatch(/^#[0-9a-f]{6}$/);
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
    for (const u of GLB_UNITS) {
      const full = statSync(path.join(dir, `${u.id}.glb`)).size;
      const lod = statSync(path.join(dir, `${u.id}.lod.glb`)).size;
      expect(lod).toBeLessThan(full * 0.65);
    }
  });
});

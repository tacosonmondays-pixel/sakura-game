// The academy girls' placed-prop GLBs (public/models/props, built by tools/blender/props/build_props.py),
// checked without WebGL: every file the runtime loads exists, stays inside the phone budget, carries the parts
// src/render/placedProps.js draws (one root empty per prop, parts as its children) with only the `body` and
// `glow` materials, no textures, skins or clips, and quantised attributes.
import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROP_FILES, FILE_PARTS, KIND_FILE } from '../../src/render/placedProps.js';
import { readGlbHeader } from './glbHeader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', '..', 'public', 'models', 'props');
const MAX_FILE = 60 * 1024;
const MAX_TOTAL = 300 * 1024;

describe('placed prop GLBs', () => {
  it('ships one file per academy girl with a placed object, inside the budget', () => {
    expect(Object.keys(PROP_FILES).sort()).toEqual(['azami_strip', 'chigusa_vines', 'kinu_pins', 'ouka_banners', 'wakaba_bottle', 'yuzuha_sentry']);
    let total = 0;
    for (const f of Object.keys(PROP_FILES)) {
      const file = path.join(dir, `${f}.glb`);
      expect(existsSync(file), file).toBe(true);
      const size = statSync(file).size;
      expect(size, f).toBeLessThanOrEqual(MAX_FILE);
      total += size;
    }
    expect(total).toBeLessThanOrEqual(MAX_TOTAL);
  });

  it('every kind the runtime draws names a shipped file', () => {
    for (const [kind, f] of Object.entries(KIND_FILE)) expect(PROP_FILES[f], kind).toBeTruthy();
  });

  for (const f of Object.keys(PROP_FILES)) {
    it(`${f}: root empties with the runtime's parts, body / glow materials, quantised, no textures or clips`, () => {
      const { json, binLength } = readGlbHeader(path.join(dir, `${f}.glb`));
      expect(json.buffers[0].byteLength).toBeLessThanOrEqual(binLength);
      expect(json.asset.generator).toBe('tools/blender/props/build_props.py');
      expect(json.asset.extras.unitScale).toBe(1);
      expect(json.extensionsRequired).toContain('KHR_mesh_quantization');
      expect(json.images || []).toHaveLength(0);
      expect(json.skins || []).toHaveLength(0);
      expect(json.animations || []).toHaveLength(0);
      for (const m of json.materials) expect(['body', 'glow']).toContain(m.name);
      const roots = json.scenes[0].nodes.map((i) => json.nodes[i]);
      expect(roots.map((n) => n.name)).toEqual(json.asset.extras.props);
      const parts = new Map();
      for (const r of roots) {
        expect(r.mesh, `${r.name} is an empty`).toBeUndefined();
        for (const c of r.children || []) {
          const n = json.nodes[c];
          expect(n.name.startsWith(`${r.name}_`), n.name).toBe(true);
          expect(n.mesh, n.name).toBeTypeOf('number');
          expect(n.children || [], `${n.name} has no children`).toHaveLength(0);
          parts.set(n.name, json.meshes[n.mesh]);
        }
      }
      expect([...parts.keys()].sort()).toEqual([...FILE_PARTS[f]].sort());
      for (const [name, mesh] of parts) {
        for (const p of mesh.primitives) {
          const pos = json.accessors[p.attributes.POSITION];
          expect(pos.componentType, `${name} positions int16`).toBe(5122);
          expect(p.attributes.COLOR_0, `${name} vertex colours`).toBeTypeOf('number');
          expect(p.attributes.TEXCOORD_0, `${name} has no UVs`).toBeUndefined();
          const mat = json.materials[p.material].name;
          // unlit parts never get an outline: glow is the heat ring band and the sentry light only
          if (mat === 'glow') expect(['heatRing_band', 'sentry_light_tint']).toContain(name);
        }
      }
    });
  }
});

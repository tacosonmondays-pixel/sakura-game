// How a hand prop is drawn on top of its GLB (src/models/glbChibi.js PROP_LOOK, display only): Tenka's coilgun is
// drawn a little bigger about its grip, self-lit in her palette's accent, with a strip in her halo colour.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROP_LOOK, propLook } from '../../src/models/glbChibi.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { readGlbHeader } from './glbHeader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const chars = path.join(here, '..', '..', 'public', 'models', 'characters');

describe('hand prop look', () => {
  it('a plain prop has no look', () => {
    expect(propLook('nope.glb')).toBe(null);
  });

  it('Tenka\'s coilgun: a modest scale-up, a self-light in her accent and a strip in her halo colour', () => {
    const l = propLook('tenka-coilgun.glb');
    expect(l.scale).toBeGreaterThan(1);
    expect(l.scale).toBeLessThanOrEqual(1.35); // never comically large
    expect(l.glow.color).toBe(UNIT_MAP.tenka.palette.accent);
    expect(l.glow.intensity).toBeGreaterThan(0);
    expect(l.glow.intensity).toBeLessThanOrEqual(0.8);
    expect(l.strip.color).toBe(UNIT_MAP.tenka.palette.halo);
    expect(l.strip.x1).toBeGreaterThan(l.strip.x0);
  });

  it('every look names a prop a figure lists, and its grip and strip sit inside the prop\'s own bounds', () => {
    for (const [file, look] of Object.entries(PROP_LOOK)) {
      const owner = file.split('-')[0];
      const { json } = readGlbHeader(path.join(chars, `${owner}.glb`));
      expect(json.asset.extras.props.map((p) => p.file)).toContain(file);
      const prop = readGlbHeader(path.join(chars, file)).json;
      const pos = prop.accessors[prop.meshes[0].primitives[0].attributes.POSITION];
      const n = pos.normalized ? 32767 : 1;
      const min = pos.min.map((v) => v / n);
      const max = pos.max.map((v) => v / n);
      for (let i = 0; i < 3; i++) {
        expect(look.grip[i]).toBeGreaterThanOrEqual(min[i]);
        expect(look.grip[i]).toBeLessThanOrEqual(max[i]);
      }
      const st = look.strip;
      expect(st.x0).toBeGreaterThanOrEqual(min[0]);
      expect(st.x1).toBeLessThanOrEqual(max[0]);
      expect(st.z).toBeGreaterThanOrEqual(max[2] - 0.02); // on the side, never buried inside the barrel
      expect(st.z).toBeLessThanOrEqual(max[2] + 0.04);
    }
  });
});

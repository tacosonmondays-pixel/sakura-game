// Node-side checks for the renderer's pure parts (no WebGL / DOM needed).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { THEMES, resolveLook, fxColor, FIELD_COLORS } from '../../src/render/themes.js';
import { resolveScenery } from '../../src/render/terrain.js';
import { CameraRig } from '../../src/render/camera.js';
import { QuadBatch } from '../../src/render/batch.js';
import { GeoBuilder, makeRand, lerpAngle } from '../../src/render/geo.js';
import { buildProp } from '../../src/render/props.js';
import { MAPS } from '../../src/data/maps.js';
import { STAGES } from '../../src/data/stages.js';
import { getEnemy } from '../../src/data/enemies.js';

const HEX = /^#[0-9a-f]{6}$/i;

describe('themes', () => {
  it('every map theme has a look with valid colours, day and night', () => {
    for (const theme of new Set(MAPS.map((m) => m.theme))) {
      expect(THEMES[theme], theme).toBeTruthy();
      for (const night of [false, true]) {
        const look = resolveLook(theme, { night, fog: night });
        for (const c of [...look.ground, look.bg, look.path.color, look.path.curb, look.water.deep, look.water.shallow, look.shore]) {
          expect(c, `${theme} ${c}`).toMatch(HEX);
        }
        expect(look.night).toBe(night || !!THEMES[theme].forceNight);
        if (night) expect(look.fogColor).toMatch(HEX);
      }
    }
  });

  it('fx colours fall back sensibly', () => {
    expect(fxColor('fire', 'blast')).toBe('#ff7a3a');
    expect(fxColor(null, 'holy')).toBe('#ffe066');
    expect(fxColor(null, null, '#123456')).toBe('#123456');
    expect(Object.keys(FIELD_COLORS)).toEqual(['haste', 'shield', 'regen']);
  });
});

describe('stage scenery', () => {
  const familyOf = (id) => {
    try {
      return getEnemy(id).family;
    } catch {
      return null;
    }
  };

  it('keeps curated props and adds at most two keywords from introduced enemies', () => {
    for (const st of STAGES) {
      const sc = resolveScenery(st, familyOf);
      const curated = st.scenery?.props || [];
      expect(sc.keywords.slice(0, curated.length)).toEqual(curated);
      expect(sc.keywords.length - curated.length).toBeLessThanOrEqual(2);
    }
  });

  it('veiled enemies bring fog and lanterns', () => {
    const sc = resolveScenery({ scenery: { props: ['sakuraTrees'] }, introduces: ['veiled'] }, familyOf);
    expect(sc.fog).toBe(true);
    expect(sc.keywords).toContain('lanterns');
  });

  it('a new monster family changes the scenery', () => {
    const sc = resolveScenery({ scenery: { props: [] }, introduces: ['dragon_wyvern'] }, familyOf);
    expect(sc.keywords).toContain('nests');
  });
});

describe('camera rig', () => {
  const corners = (map) => [[0, 0], [map.width, 0], [0, map.height], [map.width, map.height]];

  for (const [w, h, label] of [[1280, 720, 'landscape'], [390, 844, 'portrait'], [360, 640, 'small portrait']]) {
    it(`frames every map corner on screen (${label})`, () => {
      for (const map of MAPS) {
        const rig = new CameraRig(map);
        rig.setViewport(w, h, { top: 40, right: 0, bottom: 60, left: 0 });
        const v = new THREE.Vector3();
        for (const [x, z] of corners(map)) {
          v.set(x, 0, z).project(rig.camera);
          expect(Math.abs(v.x), `${map.id} x`).toBeLessThanOrEqual(1.001);
          expect(Math.abs(v.y), `${map.id} y`).toBeLessThanOrEqual(1.001);
        }
      }
    });
  }

  it('rotates to portrait for wide maps and clamps zoom', () => {
    const rig = new CameraRig({ width: 20, height: 12 });
    rig.setViewport(390, 844);
    expect(rig.yaw).toBeCloseTo(Math.PI / 2);
    rig.zoomAt(100, 195, 422);
    rig.apply(0);
    expect(rig.zoom).toBeLessThanOrEqual(3.2);
    rig.zoomAt(0.001, 195, 422);
    expect(rig.zoom).toBe(1);
    rig.panBy(10000, 10000);
    rig.apply(0);
    expect(Math.abs(rig.pan.x)).toBeLessThan(20);
    rig.reset(false);
    expect(rig.isDefault).toBe(true);
  });
});

describe('quad batch', () => {
  it('counts pushed quads and ignores invisible ones', () => {
    const b = new QuadBatch({ texture: new THREE.Texture(), max: 3 });
    b.begin();
    expect(b.push(0, 0, 0, 1, 1, [0, 0, 1, 1], 1, 1, 1, 1)).toBe(true);
    expect(b.push(0, 0, 0, 1, 1, [0, 0, 1, 1], 1, 1, 1, 0)).toBe(false);
    b.push(0, 0, 0, 1, 1, [0, 0, 1, 1], 1, 1, 1, 1);
    b.push(0, 0, 0, 1, 1, [0, 0, 1, 1], 1, 1, 1, 1);
    expect(b.push(0, 0, 0, 1, 1, [0, 0, 1, 1], 1, 1, 1, 1)).toBe(false);
    b.end();
    expect(b.geometry.instanceCount).toBe(3);
    b.dispose();
  });
});

describe('geometry + props', () => {
  it('merges coloured primitives', () => {
    const g = new GeoBuilder().box(1, 1, 1, { color: '#ff0000' }).cyl(0.2, 0.2, 1, 6, { y: 1 }).finish();
    expect(g.attributes.position.count).toBeGreaterThan(36);
    expect(g.attributes.color.count).toBe(g.attributes.position.count);
  });

  it('deterministic random + angle lerp', () => {
    const a = makeRand(5);
    const b = makeRand(5);
    expect(a()).toBe(b());
    expect(lerpAngle(3, -3, 1)).toBeCloseTo(-3 + Math.PI * 2, 5);
  });

  it('builds every prop type used by maps without throwing', () => {
    const look = resolveLook('sakura', {});
    const types = new Set(MAPS.flatMap((m) => (m.decor || []).map((d) => d.type)));
    for (const t of [...types, 'sakura', 'pine', 'snowPine', 'willow', 'house', 'shrine', 'stall', 'machine', 'lantern', 'torii']) {
      const p = buildProp(t, look, 1);
      expect(p.solid || p.foliage || p.glow, t).toBeTruthy();
    }
  });
});

// Node-side checks for the V2 terrain's pure parts: smooth roads, ribbon geometry, theme
// fields the painters rely on, scenery keywords → existing props, new prop builders.
import { describe, it, expect } from 'vitest';
import { THEMES, resolveLook } from '../../src/render/themes.js';
import { smoothRoad, buildRibbon, MeshData, SCENERY, resolveScenery, PATH_H, ROAD_HALF } from '../../src/render/terrain.js';
import { buildProp, hasProp } from '../../src/render/props.js';
import { Noise2 } from '../../src/render/textures.js';
import { MAPS } from '../../src/data/maps.js';
import { STAGES } from '../../src/data/stages.js';
import { getEnemy } from '../../src/data/enemies.js';

const HEX = /^#[0-9a-f]{6}$/i;
const GROUND_STYLES = ['grass', 'moss', 'sand', 'snow', 'ash', 'metal'];

describe('smooth roads', () => {
  const tiles = [[-3, 2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [2, 3], [2, 4], [2, 5], [3, 5], [4, 5], [5, 5]];

  it('runs through the first and last tile centres and resamples evenly', () => {
    const pts = smoothRoad(tiles, { radius: 0.6, step: 0.2 });
    expect(pts.length).toBeGreaterThan(20);
    expect(pts[0]).toEqual([-2.5, 2.5]);
    const last = pts[pts.length - 1];
    expect(last[0]).toBeCloseTo(5.5, 5);
    expect(last[1]).toBeCloseTo(5.5, 5);
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      expect(d).toBeGreaterThan(0.05);
      expect(d).toBeLessThanOrEqual(0.2001);
    }
  });

  it('rounds corners inside the corner tile (never cuts across a neighbour)', () => {
    const pts = smoothRoad(tiles, { radius: 0.6, step: 0.1 });
    // the first corner is at tile (2,2): the curve must stay within x ∈ [1.9, 2.6], z ∈ [1.9, 2.6] near it
    for (const [x, z] of pts) {
      if (x > 1.9 && z > 1.9 && x < 2.6 && z < 2.6) {
        expect(x).toBeLessThanOrEqual(2.5001);
        expect(z).toBeGreaterThanOrEqual(1.8999);
      }
      expect(Number.isFinite(x) && Number.isFinite(z)).toBe(true);
    }
  });

  it('handles degenerate paths', () => {
    expect(smoothRoad([])).toEqual([]);
    expect(smoothRoad([[3, 3]])).toEqual([[3.5, 3.5]]);
    expect(smoothRoad([[0, 0], [1, 0]]).length).toBeGreaterThanOrEqual(2);
  });

  it('works for every map path without NaNs', () => {
    for (const map of MAPS) {
      for (const wps of map.paths) {
        const tiles = [];
        for (let i = 0; i < wps.length; i++) {
          const [x, y] = wps[i];
          if (i === 0) { tiles.push([x, y]); continue; }
          const [px, py] = wps[i - 1];
          const dx = Math.sign(x - px);
          const dy = Math.sign(y - py);
          const steps = Math.max(Math.abs(x - px), Math.abs(y - py));
          for (let s = 1; s <= steps; s++) tiles.push([px + dx * s, py + dy * s]);
        }
        const pts = smoothRoad(tiles);
        expect(pts.length, map.id).toBeGreaterThan(tiles.length * 2);
        for (const p of pts) expect(Number.isFinite(p[0]) && Number.isFinite(p[1]), map.id).toBe(true);
      }
    }
  });
});

describe('road ribbon', () => {
  it('builds a raised slab with bevels, uvs along the road and skips water stretches', () => {
    const pts = smoothRoad([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], { step: 0.25 });
    const md = new MeshData(true);
    const white = { r: 1, g: 1, b: 1 };
    const grey = { r: 0.5, g: 0.5, b: 0.5 };
    buildRibbon(md, pts, { half: ROAD_HALF, bevel: 0.1, h: PATH_H, seed: 3, colorTop: () => white, colorSide: () => grey, skipAt: (x) => x > 2 && x < 3 });
    const geo = md.build(1);
    expect(geo).toBeTruthy();
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    let maxY = -1;
    let minY = 1;
    let maxZ = -9;
    for (let i = 0; i < pos.count; i++) {
      maxY = Math.max(maxY, pos.getY(i));
      minY = Math.min(minY, pos.getY(i));
      maxZ = Math.max(maxZ, Math.abs(pos.getZ(i) - 0.5));
    }
    expect(maxY).toBeCloseTo(PATH_H, 5);
    expect(minY).toBeLessThan(0);
    expect(maxZ).toBeLessThan(ROAD_HALF + 0.1 + 0.06); // wavy edge stays near the tile width
    expect(maxZ).toBeGreaterThan(ROAD_HALF);
    expect(uv.count).toBe(pos.count);
    // the water gap: no vertex with x strictly inside (2.3, 2.7) at slab height
    let inGap = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getX(i) > 2.3 && pos.getX(i) < 2.7 && pos.getY(i) > 0.04) inGap++;
    expect(inGap).toBe(0);
  });
});

describe('themes v2', () => {
  it('every theme has painter colours, a ground style, a frame ring of real props and gate colours', () => {
    for (const theme of Object.keys(THEMES)) {
      const look = resolveLook(theme, {});
      expect(GROUND_STYLES, theme).toContain(look.groundStyle);
      for (const c of [look.groundShade, look.clover, look.dirt, look.pebble, look.gate.spawn, look.gate.goal]) expect(c, theme).toMatch(HEX);
      expect(look.frame.length, theme).toBeGreaterThan(0);
      for (const f of look.frame) expect(hasProp(f), `${theme} frame ${f}`).toBe(true);
      for (const s of look.scatter || look.trees) expect(hasProp(s), `${theme} scatter ${s}`).toBe(true);
      expect(typeof look.life.butterflies).toBe('boolean');
    }
  });

  it('night turns daytime life off', () => {
    const day = resolveLook('sakura', {});
    const night = resolveLook('sakura', { night: true });
    expect(day.life.butterflies).toBe(true);
    expect(night.life.butterflies).toBe(false);
    expect(night.life.fireflies).toBe(true);
  });
});

describe('scenery keywords', () => {
  const familyOf = (id) => {
    try {
      return getEnemy(id).family;
    } catch {
      return null;
    }
  };

  it('every keyword used by a stage resolves to an existing prop or an ambient effect', () => {
    for (const st of STAGES) {
      for (const kw of resolveScenery(st, familyOf).keywords) {
        const rec = SCENERY[kw];
        expect(rec, `${st.id}: ${kw}`).toBeTruthy();
        // 'puddle' is a pseudo-prop (flat glossy discs built inside terrain.js)
        if (rec.prop && rec.prop !== 'puddle') expect(hasProp(rec.prop), `${st.id}: ${kw} → ${rec.prop}`).toBe(true);
      }
    }
  });
});

describe('props v2', () => {
  const NEW = ['fence', 'flowerBed', 'framePost', 'hazardRail', 'snowFence', 'bunting', 'stoneLanternPost', 'pineSmall', 'spawnGate', 'toriiGate', 'goalGate', 'pipes', 'cliff', 'lilyPad', 'sakura'];

  it('builds the new props for every theme, near and far', () => {
    for (const theme of Object.keys(THEMES)) {
      const look = resolveLook(theme, {});
      for (const t of NEW) {
        const p = buildProp(t, look, 2, 'far');
        expect(p.solid || p.foliage || p.glow, `${theme} ${t}`).toBeTruthy();
      }
    }
  });

  it('far canopies are cheaper than near ones', () => {
    const look = resolveLook('sakura', {});
    const near = buildProp('sakura', look, 0, 'near');
    const far = buildProp('sakura', look, 0, 'far');
    expect(far.foliage.attributes.position.count).toBeLessThan(near.foliage.attributes.position.count * 0.5);
  });

  it('gates carry a portal / goal emitter for the ambient layer', () => {
    const look = resolveLook('sakura', {});
    expect(buildProp('spawnGate', look, 0).emitters.some((e) => e.kind === 'portal')).toBe(true);
    expect(buildProp('goalGate', look, 0).emitters.some((e) => e.kind === 'goal')).toBe(true);
  });
});

describe('noise', () => {
  it('is deterministic, smooth and in [0, 1]', () => {
    const a = new Noise2(7);
    const b = new Noise2(7);
    expect(a.at(1.3, 2.7)).toBe(b.at(1.3, 2.7));
    for (let i = 0; i < 200; i++) {
      const v = a.fbm(i * 0.37, i * 0.11, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(a.at(5.0, 5.0) - a.at(5.01, 5.0))).toBeLessThan(0.05);
  });
});

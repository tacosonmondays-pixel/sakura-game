import { describe, test, expect } from 'vitest';
import { buildPath, pointAt, pathTileSet, samplePath } from '../../src/sim/path.js';
import { MAP, MAP2, makeSim } from './fixtures.js';

describe('paths', () => {
  test('waypoints become tile-centre polylines with cumulative length', () => {
    const p = buildPath([[0, 0], [4, 0], [4, 3]]);
    expect(p.points).toEqual([[0.5, 0.5], [4.5, 0.5], [4.5, 3.5]]);
    expect(p.length).toBe(7);
    const a = pointAt(p, 5);
    expect(a.x).toBeCloseTo(4.5);
    expect(a.y).toBeCloseTo(1.5);
    expect(a.facing).toBeCloseTo(0); // moving +y → rotation 0 (models face +z)
    const b = pointAt(p, 2);
    expect(b.facing).toBeCloseTo(Math.PI / 2);
    expect(pointAt(p, 100).x).toBeCloseTo(4.5);
    expect(pointAt(p, 100).y).toBeCloseTo(3.5);
  });

  test('pathTileSet stamps every tile between waypoints including off-map ends', () => {
    const set = pathTileSet({ paths: [[[-1, 2], [3, 2], [3, 5]]] });
    for (const k of ['-1,2', '0,2', '1,2', '2,2', '3,2', '3,3', '3,4', '3,5']) expect(set.has(k)).toBe(true);
    expect(set.size).toBe(8);
  });

  test('sim exposes world polylines and blocks building on path tiles', () => {
    const sim = makeSim();
    expect(sim.paths).toEqual([[[-0.5, 4.5], [16.5, 4.5]]]);
    expect(sim.canPlace('archer', 3, 4).reason).toBe('path');
    const sim2 = makeSim({ map: MAP2 });
    expect(sim2.paths).toHaveLength(2);
  });

  test('samplePath spacing', () => {
    const p = buildPath(MAP.paths[0]);
    const s = samplePath(p, 0.5);
    expect(s.length).toBe(35);
  });
});

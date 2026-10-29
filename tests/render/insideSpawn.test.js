// Gate Arc S3a · the mid-board rift (TECH §4.2, STEP3_BUILD_PLAN decision 7): a lane whose track is
// flagged `inside` (path spec `{ nodes, inside: true, … }` → MapDef.tracks[i].inside) starts in the
// middle of the board: no run-out behind it, its spawn gate where it begins (the Petal Gate's rift,
// standing on the water when the lane starts on a jetty over the lake), no cracked road under a rift
// on water. Every other lane and every shipped map draws exactly as before. Render only: the sim
// already spawns at a track's first point.
import { describe, it, expect, vi } from 'vitest';
import { planRoads, startsInside } from '../../src/render/trackMesh.js';
import { buildTerrain, resolveScenery, PATH_H } from '../../src/render/terrain.js';
import { resolveLook } from '../../src/render/themes.js';
import { MAPS } from '../../src/data/maps.js';
import { OLD_TOWN_FIXTURES, oldTownStage, defineStep3Fixture } from '../../previews/oldTownMaps.js';
import { LINE } from '../../src/core/track.js';
import { recordingDocument } from './terrainHash.js';

const rift = OLD_TOWN_FIXTURES.rift;

describe('a lane that starts inside the board', () => {
  it('the path spec flag reaches the track (the shape src/data/maps.js defineMap carries)', () => {
    expect(rift.tracks[0].inside).toBeUndefined();
    expect(rift.tracks[1].inside).toBe(true);
    const [x, y] = rift.tracks[1].points[0];
    expect(x > 1 && y > 1 && x < rift.width - 1 && y < rift.height - 1).toBe(true);
    // it starts on the lake
    expect('~B').toContain(rift.rows[Math.floor(y)][Math.floor(x)]);
  });

  it('startsInside: the flag, or a first point well inside the board; never a fork', () => {
    const W = 20;
    const H = 12;
    expect(startsInside(rift.tracks[1], W, H)).toBe(true);
    expect(startsInside(rift.tracks[0], W, H)).toBe(false);
    expect(startsInside({ points: [[5, 5], [6, 5]] }, W, H)).toBe(true);
    expect(startsInside({ points: [[-1, 5], [1, 5]] }, W, H)).toBe(false);
    expect(startsInside({ points: [[0, 5], [1, 5]] }, W, H)).toBe(false);
    expect(startsInside({ points: [[5, 5], [6, 5]], fork: { path: 0, d: 3 } }, W, H)).toBe(false);
    expect(startsInside({ points: [[-1, 5], [1, 5]], inside: true }, W, H)).toBe(true);
  });

  it('no run-out behind it: its road starts at the rift; the edge lane keeps its run-out', () => {
    const plan = planRoads(rift);
    const inner = plan.roads[1];
    expect(inner.d[0]).toBe(0);
    expect(inner.pts[0]).toEqual(rift.tracks[1].points[0]);
    expect(plan.roads[0].d[0]).toBeLessThan(-8);
    // no run-out tiles stamped behind the rift (east of its start, on the lake)
    const [sx, sy] = rift.tracks[1].points[0];
    for (const key of plan.extraTiles) {
      const [x, y] = key.split(',').map(Number);
      expect(x > sx + 0.5 && Math.abs(y - sy) < 2, `run-out tile ${key}`).toBe(false);
    }
  });

  it('its entrance sits on the lane\'s first point, facing along the lane, flagged inside', () => {
    const plan = planRoads(rift);
    const e = plan.entrances.find((g) => g.track === 1);
    const [x, y] = rift.tracks[1].points[0];
    expect(e.inside).toBe(true);
    expect(e.x).toBe(x);
    expect(e.z).toBe(y);
    // the lane heads west, toward the shore
    expect(e.dir[0]).toBeLessThan(-0.9);
    expect(Math.hypot(...e.dir)).toBeCloseTo(1, 6);
    const edge = plan.entrances.find((g) => g.track === 0);
    expect(edge.inside).toBeUndefined();
    expect(edge.x).toBeCloseTo(0, 3);
  });

  it('the terrain stands the rift on the water at the lane\'s start (no cracks under it), the edge gate as before', { timeout: 60000 }, () => {
    const rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
    try {
      const stage = oldTownStage(rift);
      const scenery = resolveScenery(stage);
      const look = resolveLook(rift.theme, scenery, stage.look, rift);
      const t = buildTerrain(rift, look, scenery, { quality: 'high' });
      const spawns = t.gates.filter((g) => g.kind === 'spawn');
      expect(spawns).toHaveLength(2);
      const mid = spawns.find((g) => g.inside);
      const [x, y] = rift.tracks[1].points[0];
      expect(mid.x).toBe(x);
      expect(mid.z).toBe(y);
      expect(mid.onWater).toBe(true);
      // the rift's glow points and emitters stand there (the petalRift prop, raised to the deck)
      expect(t.emitters.some((em) => em.kind === 'debris' && Math.hypot(em.x - x, em.z - y) < 1.5 && em.y >= PATH_H)).toBe(true);
      expect(t.marks.some((m) => m.kind === 'cracks' && Math.hypot(m.x - x, m.z - y) < 1.5)).toBe(false);
      // the edge lane's gate still has its cracked road
      const edge = spawns.find((g) => !g.inside);
      expect(t.marks.some((m) => m.kind === 'cracks' && Math.hypot(m.x - edge.x, m.z - edge.z) < 1.5)).toBe(true);
      t.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a fixture without the flag but a first point inside is drawn the same way (the renderer does not rely on the flag alone)', () => {
    const m = defineStep3Fixture({
      id: 'fixture_inside_unflagged', name: 'x', theme: 'city', desc: '',
      rows: Array.from({ length: 12 }, () => '....................'),
      paths: [[[10.5, 6.5], LINE, [21, 6.5]]],
    });
    expect(m.tracks[0].inside).toBeUndefined();
    const plan = planRoads(m);
    expect(plan.roads[0].d[0]).toBe(0);
    expect(plan.entrances[0].inside).toBe(true);
  });

  it('every shipped map draws as before: no unflagged lane starts inside, and edge lanes keep their run-outs', () => {
    for (const m of MAPS) {
      const plan = planRoads(m);
      m.tracks.forEach((t, i) => {
        if (startsInside(t, m.width, m.height)) expect(t.inside, `${m.id} path ${i}`).toBe(true);
        else if (!t.fork) expect(plan.roads[i].d[0], `${m.id} path ${i}`).toBeLessThan(0);
      });
    }
  });
});

// Gate Arc S6v · the viaduct on the shipped renderer (STEP6_BUILD_PLAN §4 / §3). S6v adds no render code:
// the road planner reads the viaduct through `track.elev` like any overpass, and buildDecks slabs every
// run with elev > 0.015, so the long deck draws on the shipped overpass look. The viaduct's own looks
// (the sky-rail girder, piers ALONG the raised run, the deck's shadow) are S6a's (trackMesh.js /
// terrain.js); `track.viaducts` ([[a, b]] foot to foot) is the hook they read.
import { describe, it, expect, vi } from 'vitest';
import { planRoads } from '../../src/render/trackMesh.js';
import { buildTerrain, resolveScenery } from '../../src/render/terrain.js';
import { resolveLook } from '../../src/render/themes.js';
import { BRIDGE_HEIGHT, VIADUCT_RAMP } from '../../src/core/track.js';
import { VIADUCT_FIXTURE, viaductStage } from '../../previews/viaductMaps.js';
import { recordingDocument } from './terrainHash.js';

describe('the viaduct on the shipped renderer', () => {
  const map = VIADUCT_FIXTURE;
  const [a, b] = map.tracks[0].viaducts[0];

  it('the road plan carries the viaduct profile: raised the whole span, full height on the flat top', () => {
    const road = planRoads(map).roads[0];
    let top = 0;
    for (let i = 0; i < road.d.length; i++) {
      const d = road.d[i];
      if (d < a - 0.25 || d > b + 0.25) expect(road.elev[i], `ground at ${d}`).toBe(0);
      if (d > a + 0.3 && d < b - 0.3) expect(road.elev[i], `raised at ${d}`).toBeGreaterThan(0.015);
      // (the planner resamples every 0.2 tiles and interpolates: a hair under the top at its very ends)
      if (d >= a + VIADUCT_RAMP && d <= b - VIADUCT_RAMP) {
        expect(road.elev[i]).toBeCloseTo(BRIDGE_HEIGHT, 4);
        top++;
      }
    }
    expect(top).toBeGreaterThan(30);
  });

  it('buildTerrain draws the fixture at every quality without errors', { timeout: 60000 }, () => {
    const rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
    try {
      const stage = viaductStage();
      const scenery = resolveScenery(stage);
      const look = resolveLook(map.theme, scenery, stage.look || null, map);
      for (const quality of ['high', 'low']) {
        const t = buildTerrain(map, look, scenery, { quality });
        expect(t.gates.filter((g) => g.kind === 'spawn')).toHaveLength(1);
        t.dispose();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

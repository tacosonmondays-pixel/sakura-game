// Story landmarks swapped for their Tripo models inside a real map build (src/render/tripoLandmarks.js, terrain.js):
// with a loader present (mocked here: canLoadCharacters true, loadTripoProp resolving a stand-in model) each landmark
// on its story stage is its own group; after the swap its solid pieces hide and the Tripo mesh stands in, while every
// glow mesh it has (lamps, lit windows) stays visible, at night and in a blackout, still carrying its dim weight.
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';

vi.mock('../../src/models/glbChibi.js', async (orig) => ({ ...(await orig()), canLoadCharacters: () => true }));
vi.mock('../../src/render/tripoProps.js', async (orig) => ({
  ...(await orig()),
  loadTripoProp: () => Promise.resolve({
    geometry: new THREE.BoxGeometry(0.4, 0.8, 0.4).translate(0, 0.4, 0),
    material: new THREE.MeshLambertMaterial(),
  }),
}));

const { buildTerrain, resolveScenery } = await import('../../src/render/terrain.js');
const { resolveLook } = await import('../../src/render/themes.js');
const { STAGES } = await import('../../src/data/stages.js');
const { MAP_MAP } = await import('../../src/data/maps.js');
const { TRIPO_LANDMARKS } = await import('../../src/render/tripoLandmarks.js');
const { recordingDocument } = await import('./terrainHash.js');

afterEach(() => vi.unstubAllGlobals());

// the story stages whose map decor holds a landmark with a Tripo model
const STAGE_IDS = ['1-6', '1-9', '1-10', '2-10', '5-10', '6-8', '6-10'];

async function build(stageId, lookOverride = {}) {
  const stage = STAGES.find((s) => s.id === stageId);
  const map = MAP_MAP[stage.mapId];
  const scenery = resolveScenery(stage);
  const look = { ...resolveLook(map.theme, scenery, stage.look), ...lookOverride };
  const t = buildTerrain(map, look, scenery, { quality: 'high' });
  await new Promise((r) => setTimeout(r, 0)); // the mocked loads resolve
  await Promise.resolve();
  return t;
}

describe('Tripo story landmarks in a map build', () => {
  it('every landmark group swaps in its model; glow meshes stay visible at night and in a blackout', async () => {
    const rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
    const typesWithGlow = new Set();
    const seen = new Set();
    for (const id of STAGE_IDS) {
      for (const mode of [{ night: true }, { night: true, blackout: true }]) {
        const t = await build(id, mode);
        for (const g of t.landmarks) {
          const type = g.userData.landmark.split('/')[1];
          seen.add(type);
          const tripo = g.userData.tripoLandmark;
          expect(tripo, `${id} ${type}`).toBeTruthy();
          expect(tripo.visible).toBe(true);
          for (const c of g.children) {
            if (c === tripo) continue;
            if (c.userData.glow) {
              typesWithGlow.add(type);
              expect(c.visible, `${id} ${type} glow`).toBe(true);
              if (mode.blackout) expect(c.geometry.attributes.dimk, `${id} ${type} dim weight`).toBeTruthy();
            } else {
              expect(c.visible, `${id} ${type} solid`).toBe(false);
            }
          }
        }
        t.dispose();
      }
    }
    // the landmarks these story stages place (the finish gantry and school wing come from the campus kit), and the
    // ones with glow geometry (the lamp and the fountain light with glow sprites, which never hide)
    for (const type of seen) expect(Object.keys(TRIPO_LANDMARKS)).toContain(type);
    expect([...seen].sort()).toEqual(['clockTower', 'doorieStatue', 'dryFountain', 'greatWillow', 'lockGate', 'oldLamp', 'schoolBlock', 'spindle', 'ticketGates']);
    expect([...typesWithGlow].sort()).toEqual(['clockTower', 'greatWillow', 'spindle', 'ticketGates']);
  });
});

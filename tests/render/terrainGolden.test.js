// Golden fingerprints of every shipped (non-city) battle terrain: the Gate Arc's city work keeps
// editing the shared terrain code (terrain.js, textures.js, props.js, trackMesh.js, ambient
// marks), and the other themes must stay exactly as they shipped. Each entry is buildTerrain() for
// one stage look (map + scenery + stage look + introduced families) hashed by terrainHash.js:
// geometry, world matrices, material sort fields, glows, emitters, marks, gates and every painted
// canvas (recorded draw commands stand in for pixels under node).
//
// The golden values were taken on feature/gate-arc and match the tree before any city code
// (S1a, cbe0e165) entry for entry. If a change to a shipped theme is intended, regenerate them:
//   UPDATE_TERRAIN_GOLDEN=1 npx vitest run tests/render/terrainGolden.test.js
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAPS } from '../../src/data/maps.js';
import { STAGES } from '../../src/data/stages.js';
import { getEnemy } from '../../src/data/enemies.js';
import { buildTerrain, resolveScenery } from '../../src/render/terrain.js';
import { resolveLook } from '../../src/render/themes.js';
import { recordingDocument, terrainFingerprint } from './terrainHash.js';

const GOLDEN_FILE = fileURLToPath(new URL('./terrainGolden.json', import.meta.url));
const UPDATE = process.env.UPDATE_TERRAIN_GOLDEN === '1';

/** One entry per distinct stage look on a shipped theme: all at high, the first of each theme at low. */
function looks() {
  const out = [];
  const seen = new Set();
  const lowThemes = new Set();
  for (const st of STAGES) {
    const map = MAPS.find((m) => m.id === st.mapId);
    if (!map || map.theme === 'city') continue;
    const key = `${st.mapId}|${JSON.stringify(st.scenery || {})}|${JSON.stringify(st.look || null)}|${(st.introduces || []).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ st, map, q: 'high' });
    if (!lowThemes.has(map.theme)) {
      lowThemes.add(map.theme);
      out.push({ st, map, q: 'low' });
    }
  }
  return out;
}

describe('shipped terrains are unchanged (golden fingerprints)', () => {
  let rec;
  beforeAll(() => {
    rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
  });
  afterAll(() => vi.unstubAllGlobals());

  const fingerprint = (map, st, q, tweak = null) => {
    const scenery = resolveScenery(st, (id) => getEnemy(id)?.family || null);
    const look = resolveLook(map.theme, scenery, st.look || null);
    if (tweak) tweak(look);
    rec.canvases.length = 0;
    const t = buildTerrain(map, look, scenery, { quality: q });
    const f = terrainFingerprint(t, rec.canvases);
    t.dispose();
    return f;
  };

  it('every shipped stage look builds the terrain it built before the city', () => {
    const golden = UPDATE ? {} : JSON.parse(readFileSync(GOLDEN_FILE, 'utf8'));
    const now = {};
    for (const { st, map, q } of looks()) now[`${st.id}|${q}`] = fingerprint(map, st, q);
    if (UPDATE) {
      writeFileSync(GOLDEN_FILE, `${JSON.stringify(now, null, 1)}\n`);
      return;
    }
    expect(Object.keys(golden).length).toBeGreaterThanOrEqual(55);
    const changed = [];
    for (const [k, h] of Object.entries(golden)) {
      expect(now[k], `${k} is still built`).toBeDefined();
      if (now[k] !== h) changed.push(`${k}: ${h} → ${now[k]}`);
    }
    expect(changed, 'shipped terrains changed (see the header to regenerate if intended)').toEqual([]);
  }, 300000);

  it('the fingerprint sees a painted-ground change and a geometry change', () => {
    const st = STAGES.find((s) => s.id === '1-1');
    const map = MAPS.find((m) => m.id === st.mapId);
    const base = fingerprint(map, st, 'low');
    expect(fingerprint(map, st, 'low')).toBe(base);
    expect(fingerprint(map, st, 'low', (look) => { look.ground = ['#a0d77a', look.ground[1]]; })).not.toBe(base);
    expect(fingerprint(map, st, 'low', (look) => { look.frame = []; })).not.toBe(base);
  }, 120000);
});

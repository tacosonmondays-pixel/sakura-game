// Smoke test against the real game data. Skipped automatically while the data files are
// still stubs (other areas build them concurrently).
import { describe, test, expect } from 'vitest';
import { hasRealData, defaultData } from '../../src/sim/data.js';
import { Sim } from '../../src/sim/Sim.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';

const ready = hasRealData();

describe.skipIf(!ready)('real data smoke', () => {
  test('every stage builds a Sim and previews its first wave', () => {
    const d = defaultData();
    for (const stage of Object.values(d.stages)) {
      const sim = new Sim({ stageId: stage.id, difficulty: 'normal', seed: 1 });
      expect(sim.paths.length).toBeGreaterThan(0);
      expect(sim.maxLives).toBe(100);
      const preview = sim.nextWavePreview();
      expect(Array.isArray(preview)).toBe(true);
      for (const p of preview) expect(d.enemies[p.enemyId]).toBeTruthy();
    }
  });

  test('the first campaign stage runs headless with the starter units', () => {
    const d = defaultData();
    const stage = d.stages['1-1'] || Object.values(d.stages).find((s) => s.kind === 'campaign');
    const starters = Object.values(d.units).filter((u) => u.acquisition?.type === 'starter').map((u) => u.id);
    const plan = autoPlan(stage.id, starters);
    expect(plan.length).toBeGreaterThan(0);
    const r = runHeadless({ stageId: stage.id, difficulty: 'normal', plan, seed: 1, maxTime: 3600 });
    expect(r.wave).toBeGreaterThan(0);
    expect(r.result.encountered.length).toBeGreaterThan(0);
  });
});

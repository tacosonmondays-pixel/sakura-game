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

  // Balance report (CONTRACTS.md §6: autoPlan checks campaign stages with free units only).
  // Informational: prints a table instead of failing, because balance belongs to world/units;
  // it only asserts that every stage runs to a result without errors.
  test('campaign sweep on Normal with free units (report)', () => {
    const d = defaultData();
    const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
    const order = new Map(campaign.map((s, i) => [s.id, i]));
    const rows = [];
    for (const stage of campaign) {
      const idx = order.get(stage.id);
      const avail = Object.values(d.units).filter((u) => {
        const a = u.acquisition || {};
        if (a.type === 'starter') return true;
        return a.type === 'free' && order.has(a.afterStage) && order.get(a.afterStage) < idx;
      });
      const recency = (u) => (u.acquisition?.type === 'free' ? order.get(u.acquisition.afterStage) : -1);
      const towers = avail.filter((u) => u.kind === 'tower').sort((a, b) => recency(b) - recency(a)).slice(0, 8);
      const hero = avail.filter((u) => u.kind === 'hero').sort((a, b) => recency(b) - recency(a))[0];
      const ids = [...towers.map((u) => u.id), ...(hero ? [hero.id] : [])];
      const plan = autoPlan(stage.id, ids);
      const r = runHeadless({ stageId: stage.id, difficulty: 'normal', plan, seed: 1, maxTime: 7200 });
      expect(r.wave).toBeGreaterThan(0);
      rows.push(`${stage.id.padEnd(5)} ${r.won ? 'WON ' : 'LOST'} wave ${r.wave}/${r.sim.totalWaves} lives ${r.lives}/${r.maxLives} [${ids.join(',')}]`);
    }
    console.log(`[balance] campaign sweep (normal, free units, autoPlan):\n${rows.join('\n')}`);
  }, 300000);
});

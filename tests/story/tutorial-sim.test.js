// T-coach-3 (STORY_SPEC §2.3): the coached first battle is winnable the way a brand-new player is walked through
// it, on the real 1-1 Easy with the new-save formation. Aoi goes on the coach's suggested spot before wave 1,
// Hikari is placed and Aoi gets her first upgrade after wave 1 — nothing else is bought. This REPORTS the numbers
// (wave of the ult unlock, lives left); it does not tune the sim (balance is owned by feature/balance-playtest).
import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Sim } from '../../src/sim/Sim.js';
import { createProfile } from '../../src/systems/save.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { resolveFormation } from '../../src/ui/battle/setup.js';
import { suggestSpots } from '../../src/ui/story/coachSteps.js';
import { TUTORIAL_STAGE, TUTORIAL_DIFFICULTY } from '../../src/systems/story.js';

function coachedRun(seed) {
  const p = createProfile();
  const { towers, hero } = resolveFormation(p);
  const sim = new Sim({
    stageId: TUTORIAL_STAGE,
    difficulty: TUTORIAL_DIFFICULTY,
    loadout: towers.map((unitId) => ({ unitId, stats: unitBattleStats(p, unitId) })),
    hero: hero ? { unitId: hero, stats: unitBattleStats(p, hero) } : null,
    seed,
  });
  const log = { formation: { towers, hero }, ultUnlockedWave: null, heroWave: null, upgradeWave: null };

  // step 1: Aoi on the drag hand's spot
  const [spot] = suggestSpots(sim, 'aoi');
  const aoi = sim.placeTower('aoi', spot.x, spot.y);
  // step 2: start wave 1
  sim.startNextWave();
  const run = () => {
    for (let i = 0; i < 4000 && sim.state === 'wave'; i++) {
      sim.update(0.25);
      if (log.ultUnlockedWave == null && sim.heroUltStatus().unlocked) log.ultUnlockedWave = sim.wave;
    }
  };
  run();
  // between waves 1 and 2: step 3 (Hikari) and step 4 (Aoi's cheapest tier 1), as soon as the coins allow
  while (sim.state === 'between') {
    if (!sim.hero && sim.cash >= sim.placeCost('hikari')) {
      const q = suggestSpots(sim, 'hikari')[0];
      if (q && sim.placeTower('hikari', q.x, q.y)) log.heroWave = sim.wave;
    }
    if (aoi.tiers.every((t) => t === 0)) {
      const paths = [0, 1, 2].map((path) => ({ path, st: sim.upgradeStatus(aoi.uid, path) })).filter((x) => !x.st.locked);
      paths.sort((a, b) => a.st.cost - b.st.cost);
      if (paths[0] && sim.upgradeTower(aoi.uid, paths[0].path)) log.upgradeWave = sim.wave;
    }
    sim.startNextWave();
    run();
  }
  return { sim, log };
}

const reports = [];
describe('the coached 1-1 Easy (T-coach-3)', () => {
  // TUTORIAL_REPORT=<file> writes the numbers for the commit message / balance notes
  afterAll(() => {
    const out = process.env.TUTORIAL_REPORT;
    if (!out) return;
    mkdirSync(out.replace(/[^/]+$/, '') || '.', { recursive: true });
    writeFileSync(out, `${reports.map((r) => JSON.stringify(r)).join('\n')}\n`);
  });
  for (const seed of [1, 2, 3]) {
    it(`a new player following Hikari's tips wins (seed ${seed})`, () => {
      const { sim, log } = coachedRun(seed);
      const report = { seed, state: sim.state, wave: sim.wave, lives: `${sim.lives}/${sim.maxLives}`, ...log };
      reports.push(report);
      expect(log.formation).toEqual({ towers: ['aoi', 'rei'], hero: 'hikari' });
      expect(log.heroWave, 'Hikari placed after wave 1').toBe(1);
      expect(log.upgradeWave, 'Aoi upgraded after wave 1 or 2').toBeLessThanOrEqual(2);
      expect(sim.state, JSON.stringify(report)).toBe('won');
      // the ult step can only show if her ultimate unlocks before the last wave
      expect(log.ultUnlockedWave, JSON.stringify(report)).not.toBeNull();
      expect(log.ultUnlockedWave).toBeLessThan(sim.totalWaves);
    });
  }
});

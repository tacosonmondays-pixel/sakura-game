// Tutorial coach (STORY_SPEC §6 T-coach-1, T-coach-2): the pure step machine over synthetic snapshots, the battle-UI
// test ids the coach points at, the drag-hand spot finder on the real 1-1 map, and the 1-1 prep prompt rule.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  CORE_STEPS, ALL_STEPS, COACH_TARGETS, coachSnapshot, updateDone, gateOpen, nextStep, suggestSpots, focusTower, retarget,
} from '../../src/ui/story/coachSteps.js';
import { COACH_STEP_IDS } from '../../src/data/story/tutorial.js';
import { resolveText } from '../../src/data/story/tokens.js';
import { Sim } from '../../src/sim/Sim.js';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import {
  tutorialPromptDue, setOpening, setTutorial, tutorialRoute, TUTORIAL_STAGE, TUTORIAL_DIFFICULTY,
} from '../../src/systems/story.js';
import { UNIT_MAP } from '../../src/data/units.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A synthetic snapshot: a fresh 1-1 Easy battle in prep (650 coins, Aoi 162, Hikari 423). */
const snap = (o = {}) => ({
  state: 'prep', wave: 0, totalWaves: 12, cash: 650, towers: 0, hasTowers: true, heroId: 'hikari', heroPlaced: false,
  heroCost: 423, cheapestUpgrade: Infinity, upgraded: false, speed: 1, ultUnlocked: false, ultReady: false, ultsUsed: 0, ...o,
});
/** Run the machine the way the coach does: mark done, then pick (keeping a shown core step). */
const step = (s, done, current = null) => nextStep(s, updateDone(s, done), current);

function tutorialSim(seed = 3) {
  const p = createProfile();
  return new Sim({
    stageId: TUTORIAL_STAGE,
    difficulty: TUTORIAL_DIFFICULTY,
    loadout: ['aoi', 'rei'].map((unitId) => ({ unitId, stats: unitBattleStats(p, unitId) })),
    hero: { unitId: 'hikari', stats: unitBattleStats(p, 'hikari') },
    seed,
  });
}

describe('coach step machine (T-coach-1)', () => {
  it('lists the same steps as the coach copy', () => {
    expect(ALL_STEPS).toEqual(COACH_STEP_IDS);
    expect(CORE_STEPS).toEqual(['place', 'start', 'hero', 'upgrade', 'speed']);
  });

  it('walks place → start → hero → upgrade → speed → free', () => {
    const done = new Set();
    expect(step(snap(), done)).toBe('place');
    // Aoi placed: start the wave
    expect(step(snap({ towers: 1, cash: 488 }), done, 'place')).toBe('start');
    // wave 1 running: nothing to coach yet (hero and upgrade wait for a quiet moment)
    expect(step(snap({ state: 'wave', wave: 1, towers: 1, cash: 300, cheapestUpgrade: 72 }), done, 'start')).toBe(null);
    // between waves with enough for the hero
    let s = snap({ state: 'between', wave: 1, towers: 1, cash: 520, cheapestUpgrade: 72 });
    expect(step(s, done, null)).toBe('hero');
    // the hero is on the field: upgrade next (still between waves, coins for a tier 1)
    s = snap({ state: 'between', wave: 1, towers: 1, heroPlaced: true, cash: 97, cheapestUpgrade: 72 });
    expect(step(s, done, 'hero')).toBe('upgrade');
    // a shown core step stays through the next wave until it is done
    s = snap({ state: 'wave', wave: 2, towers: 1, heroPlaced: true, cash: 40, cheapestUpgrade: 72 });
    expect(step(s, done, 'upgrade')).toBe('upgrade');
    s = snap({ state: 'wave', wave: 2, towers: 1, heroPlaced: true, upgraded: true, cash: 10, cheapestUpgrade: 81 });
    expect(step(s, done, 'upgrade')).toBe('speed');
    s = snap({ state: 'wave', wave: 2, towers: 1, heroPlaced: true, upgraded: true, speed: 2 });
    expect(step(s, done, 'speed')).toBe('free');
    // the coach marks `free` after showing it; nothing is left to say
    done.add('free');
    expect(step(s, done, 'free')).toBe(null);
  });

  it('gates the hero on coins between waves, or from wave 2', () => {
    const done = new Set(['place', 'start']);
    expect(gateOpen('hero', snap({ state: 'between', wave: 1, cash: 300 }), done)).toBe(false);
    expect(gateOpen('hero', snap({ state: 'wave', wave: 1, cash: 900 }), done)).toBe(false);
    expect(gateOpen('hero', snap({ state: 'between', wave: 1, cash: 423 }), done)).toBe(true);
    expect(gateOpen('hero', snap({ state: 'wave', wave: 2, cash: 0 }), done)).toBe(true);
  });

  it('gates the upgrade on a tier-1 price between waves (or from wave 3), and speed on the upgrade', () => {
    const done = new Set(['place', 'start', 'hero']);
    expect(gateOpen('upgrade', snap({ state: 'between', wave: 1, cash: 50, cheapestUpgrade: 72 }), done)).toBe(false);
    expect(gateOpen('upgrade', snap({ state: 'between', wave: 1, cash: 80, cheapestUpgrade: 72 }), done)).toBe(true);
    expect(gateOpen('upgrade', snap({ state: 'wave', wave: 2, cash: 80, cheapestUpgrade: 72 }), done)).toBe(false);
    expect(gateOpen('upgrade', snap({ state: 'wave', wave: 3, cash: 80, cheapestUpgrade: 72 }), done)).toBe(true);
    expect(gateOpen('speed', snap({ wave: 5 }), done)).toBe(false);
    done.add('upgrade');
    expect(gateOpen('speed', snap({ wave: 1 }), done)).toBe(false);
    expect(gateOpen('speed', snap({ wave: 2 }), done)).toBe(true);
  });

  it('lets the ultimate preempt any step once it is ready, once', () => {
    const done = new Set();
    const s = snap({ state: 'wave', wave: 4, towers: 1, heroPlaced: true, cash: 0, ultUnlocked: true, ultReady: true });
    expect(step(s, done, 'upgrade')).toBe('ult');
    // fired: back to the step that was waiting
    const after = { ...s, ultReady: false, ultsUsed: 1 };
    expect(step(after, done, 'upgrade')).toBe('upgrade');
    // the current id is only a memory of the last core step: 'ult' itself never sticks
    expect(step(after, done, 'ult')).toBe(null);
    expect(step({ ...after, ultReady: true }, done, 'upgrade')).toBe('upgrade');
  });

  it('shows the defeat step on a loss and nothing on a win', () => {
    expect(step(snap({ state: 'lost', wave: 6, towers: 2 }), new Set(), 'upgrade')).toBe('lost');
    expect(step(snap({ state: 'won', wave: 12, towers: 2 }), new Set(), 'speed')).toBe(null);
  });

  it('never asks for what the formation cannot do', () => {
    const done = new Set();
    // no hero in the formation: the hero and ult steps are done from the start
    const s = snap({ heroId: null, heroCost: Infinity, towers: 1, state: 'between', wave: 2, cash: 999, cheapestUpgrade: 72 });
    updateDone(s, done);
    expect(done.has('hero') && done.has('ult')).toBe(true);
    expect(step(s, done)).toBe('upgrade');
    // a default speed of 2× already counts
    expect(updateDone(snap({ speed: 2 }), new Set()).has('speed')).toBe(true);
  });

  it('reads a real Sim into a snapshot', () => {
    const sim = tutorialSim();
    const s = coachSnapshot(sim, { speed: 1 });
    expect(s).toMatchObject({ state: 'prep', wave: 0, towers: 0, heroId: 'hikari', heroPlaced: false, hasTowers: true, speed: 1 });
    expect(s.heroCost).toBe(sim.placeCost('hikari'));
    expect(nextStep(s, updateDone(s, new Set()))).toBe('place');
  });
});

describe('coach targets exist in the battle UI (T-coach-2)', () => {
  const dir = join(ROOT, 'src', 'ui', 'battle');
  const source = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  for (const [step, id] of Object.entries(COACH_TARGETS)) {
    it(`${step} → data-testid "${id}"`, () => {
      const re = id.endsWith('-') ? new RegExp(`'data-testid':\\s*\`${id}\\$\\{`) : new RegExp(`'data-testid':\\s*'${id}'`);
      expect(re.test(source), `battle UI has data-testid ${id}`).toBe(true);
    });
  }
  it('the controller mounts the coach only for tutorial=1', () => {
    const ctl = readFileSync(join(dir, 'controller.js'), 'utf8');
    expect(ctl).toMatch(/params\.tutorial === '1'/);
    expect(ctl).toMatch(/import\('\.\.\/story\/coach\.js'\)/);
  });
  it('the hud, bar and panel classes the coach measures exist', () => {
    const coach = readFileSync(join(ROOT, 'src', 'ui', 'story', 'coach.js'), 'utf8');
    for (const cls of ['bt-hud', 'bt-result', 'bt-result-actions']) {
      expect(coach).toContain(cls);
      expect(source).toContain(`.${cls}`);
    }
  });
});

describe('drag-hand spots on 1-1', () => {
  it('suggests valid ground about 1.3 tiles beside the path, 30–45 % along it', () => {
    const sim = tutorialSim();
    const spots = suggestSpots(sim, 'aoi');
    expect(spots.length).toBeGreaterThan(3);
    for (const p of spots) {
      expect(sim.canPlace('aoi', p.x, p.y).ok, JSON.stringify(p)).toBe(true);
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(false);
      expect(p.f).toBeGreaterThanOrEqual(0.3 - 1e-9);
      expect(p.f).toBeLessThanOrEqual(0.45 + 1e-9);
    }
    expect(spots[0].dist).toBe(1.3);
  });

  it('a girl dropped there stands there', () => {
    const sim = tutorialSim();
    const [p] = suggestSpots(sim, 'aoi');
    const t = sim.placeTower('aoi', p.x, p.y);
    expect(t).toBeTruthy();
    expect(Math.hypot(t.x - p.x, t.y - p.y)).toBeLessThan(0.01);
    // the next suggestion for Hikari avoids Aoi
    const [q] = suggestSpots(sim, 'hikari');
    expect(sim.canPlace('hikari', q.x, q.y).ok).toBe(true);
  });

  it('talks about Aoi, or whoever leads a different formation', () => {
    expect(focusTower(tutorialSim())).toBe('aoi');
    const p = createProfile();
    const sim = new Sim({ stageId: '1-1', difficulty: 'easy', loadout: [{ unitId: 'rei', stats: unitBattleStats(p, 'rei') }], seed: 1 });
    expect(focusTower(sim)).toBe('rei');
    expect(resolveText(retarget("Drag {name:aoi}'s card", { tower: 'rei' }))).toBe(`Drag ${UNIT_MAP.rei.name}'s card`);
    expect(retarget('{ult:hikari} is ready', { hero: 'luna' })).toBe('{ult:luna} is ready');
    expect(retarget('{name:aoi}', {})).toBe('{name:aoi}');
  });
});

describe('the 1-1 prep prompt and the tutorial route', () => {
  it('asks only a new player who met Hikari and left the coached battle unfinished', () => {
    const p = createProfile();
    expect(tutorialPromptDue(p)).toBe(false); // the opening comes first
    setOpening(p, 'skipped');
    expect(tutorialPromptDue(p)).toBe(true);
    expect(tutorialPromptDue(p, '1-2')).toBe(false);
    setTutorial(p, 'skipped'); // Not now
    expect(tutorialPromptDue(p)).toBe(false);
    const q = createProfile();
    setOpening(q, 'seen');
    setTutorial(q, 'done');
    expect(tutorialPromptDue(q)).toBe(false);
    // a legacy save is never asked
    const raw = JSON.parse(JSON.stringify(createProfile()));
    delete raw.story;
    expect(tutorialPromptDue(migrateProfile(raw))).toBe(false);
  });

  it('a done tutorial never goes back; a skipped one can still be finished', () => {
    const p = createProfile();
    expect(setTutorial(p, 'skipped')).toBe(true);
    expect(setTutorial(p, 'done')).toBe(true);
    expect(setTutorial(p, 'skipped')).toBe(false);
    expect(p.story.tutorial).toBe('done');
    expect(tutorialRoute()).toEqual({ name: 'battle', params: { stage: '1-1', difficulty: 'easy', tutorial: '1' } });
  });
});

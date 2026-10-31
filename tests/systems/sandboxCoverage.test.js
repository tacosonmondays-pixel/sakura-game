// The Sandbox never falls behind again (docs/specs/SANDBOX_CATCHUP.md): every unit, every stage of every mode (event
// stages too), every titan and tier, every freeplay tier, every battle mode, every gear slot, set and LR kind, and every
// enemy family must be reachable from the Sandbox's own lists, and its default build must be the game's true maximum.
// A new unit, stage kind, slot or set that the Sandbox does not know fails here.
import { describe, it, expect } from 'vitest';
import { UNITS } from '../../src/data/units.js';
import { STAGES } from '../../src/data/stages.js';
import { EVENT_STAGES, EVENT_ENEMIES } from '../../src/data/events/index.js';
import { ENEMIES, FAMILIES } from '../../src/data/enemies.js';
import { TITANS, TITAN_TIERS } from '../../src/data/titans.js';
import { FREEPLAY_TIERS } from '../../src/data/freeplay.js';
import { MODE_ORDER } from '../../src/data/modes.js';
import { SLOT_IDS } from '../../src/data/gearSlots.js';
import { SET_IDS } from '../../src/data/gearSets.js';
import { LR_SET, LR_BLANK } from '../../src/data/gearAwaken.js';
import { isLegendUnit } from '../../src/data/banners.js';
import { MAX_LEVEL, MAX_AWAKEN, MAX_BREAKTHROUGH, GATE_CAPS, BREAKTHROUGH_LEVEL_CAP } from '../../src/systems/progression.js';
import { MAX_POTENTIAL } from '../../src/systems/potential.js';
import { isUrGear, lrKind } from '../../src/systems/gear.js';
import { enemyGroups } from '../../src/ui/battle/sandboxPanel.js';
import { parseBattleParams, createBattleSim } from '../../src/ui/battle/setup.js';
import {
  sandboxRoster, sandboxStages, sandboxTitans, sandboxGroupOf, SANDBOX_GROUPS, SANDBOX_GEAR_PRESETS, SANDBOX_MAX_BUILD, SANDBOX_LEVEL_PICKS,
  sandboxGear, sandboxProfile, sandboxUnitStats, sandboxBattleParams, parseSandboxRun, sandboxFreeplayOk,
} from '../../src/systems/sandbox.js';

const ALL_STAGES = [...STAGES, ...EVENT_STAGES];
const runSim = (params) => {
  const req = parseBattleParams({ sandbox: '1', team: 'kage', ...params }, null);
  expect(req.error).toBe(null);
  return createBattleSim(null, { ...req, seed: 11 }).sim;
};

describe('sandbox coverage: units', () => {
  it('offers every unit in the game (held and LR ones too)', () => {
    const offered = new Set(sandboxRoster().map((u) => u.id));
    for (const u of UNITS) expect(offered.has(u.id), u.id).toBe(true);
    for (const id of ['tenka', 'kohaku_tsubaki', 'kogane', 'norika']) expect(offered.has(id), id).toBe(true);
  });

  it('the default build is the true maximum of every axis (LR for an LR unit)', () => {
    expect(SANDBOX_MAX_BUILD).toMatchObject({ level: MAX_LEVEL, p: MAX_POTENTIAL, stars: MAX_AWAKEN, lr: true });
    for (const u of UNITS) {
      const s = sandboxUnitStats(u.id);
      expect([s.level, s.potential, s.awaken, s.breakthrough], u.id).toEqual([MAX_LEVEL, MAX_POTENTIAL, MAX_AWAKEN, MAX_BREAKTHROUGH]);
      expect(!!s.lr, u.id).toBe(isLegendUnit(u.id));
    }
  });

  it('the level picks hold every level cap step from 60', () => {
    for (const c of GATE_CAPS.filter((x) => x >= BREAKTHROUGH_LEVEL_CAP)) expect(SANDBOX_LEVEL_PICKS).toContain(c);
    expect(Math.max(...SANDBOX_LEVEL_PICKS)).toBe(MAX_LEVEL);
  });
});

describe('sandbox coverage: stages and modes', () => {
  it('knows every stage kind and offers every stage, event stages included', () => {
    const offered = new Set(sandboxStages().map((s) => s.id));
    const groups = new Set(SANDBOX_GROUPS.map((g) => g.id));
    for (const s of ALL_STAGES) {
      expect(sandboxGroupOf(s), `${s.id} (${s.kind})`).not.toBe(null);
      expect(groups.has(sandboxGroupOf(s)), s.id).toBe(true);
      expect(offered.has(s.id), s.id).toBe(true);
    }
  });

  it('every offered stage builds a sandbox battle that starts a wave', () => {
    for (const { id, stage } of sandboxStages()) {
      const sim = runSim({ stage: id, difficulty: stage.difficulties?.[0] || 'normal' });
      expect(sim.stageId, id).toBe(id);
      expect(sim.startNextWave(), id).toBe(true);
      expect(sim.warnings, id).toEqual([]);
    }
  });

  it('offers every titan on every tier (Mayhem ranks too)', () => {
    expect(sandboxTitans().map((t) => t.id).sort()).toEqual(TITANS.map((t) => t.id).sort());
    for (const t of TITANS) {
      for (const tier of TITAN_TIERS) {
        const sim = runSim(sandboxBattleParams({ titan: { id: t.id, tier, rank: tier === 'mayhem' ? 30 : 0 }, towers: ['kage'] }));
        expect(sim.stageId, `${t.id} ${tier}`).toMatch(new RegExp(`^titan:${t.id}:${tier}`));
        expect(sim.startNextWave()).toBe(true);
      }
    }
  });

  it('offers every freeplay tier on every campaign stage, and every battle mode', () => {
    const campaign = STAGES.filter((s) => sandboxFreeplayOk(s.id));
    expect(campaign.length).toBe(STAGES.filter((s) => s.kind === 'campaign').length);
    for (const tier of FREEPLAY_TIERS) expect(parseSandboxRun({ fp: tier }, campaign[0].id).freeplay).toBe(tier);
    for (const m of MODE_ORDER) expect(parseSandboxRun({ bmode: m }, campaign[0].id).mode).toBe(m);
  });
});

describe('sandbox coverage: gear', () => {
  it('reaches every slot, every set at Legendary, UR and Set LR (the LR Set Form), and Blank LR', () => {
    const slots = new Set();
    const sets = new Set();
    for (const key of SANDBOX_GEAR_PRESETS) for (const g of sandboxGear('kage', key)) slots.add(g.slot);
    for (const s of SLOT_IDS) expect(slots.has(s), s).toBe(true);
    for (const set of SET_IDS) {
      for (const r of ['leg', 'ur', 'lr']) {
        expect(SANDBOX_GEAR_PRESETS).toContain(`${r}-${set}`);
        const st = sandboxUnitStats('kage', { ...SANDBOX_MAX_BUILD, gear: `${r}-${set}` });
        expect([st.set, st.setN], `${r}-${set}`).toEqual([set, 5]);
        expect(st.setLr, `${r}-${set}`).toBe(r === 'lr');
        sets.add(set);
      }
    }
    expect([...sets].sort()).toEqual([...SET_IDS].sort());
    expect(sandboxGear('kage', 'lr-geometry').every((g) => lrKind(g) === LR_SET)).toBe(true);
    expect(sandboxGear('kage', 'blank').every((g) => lrKind(g) === LR_BLANK && !g.set)).toBe(true);
    expect(sandboxGear('kage', 'ur-spirit').every((g) => isUrGear(g) && lrKind(g) === 0)).toBe(true);
  });
});

describe('sandbox coverage: enemies', () => {
  it('the spawn picker lists every enemy of every family, event enemies included', () => {
    const groups = enemyGroups();
    const ids = new Set(groups.flatMap((g) => g.enemies.map((e) => e.id)));
    for (const e of [...ENEMIES, ...EVENT_ENEMIES]) expect(ids.has(e.id), e.id).toBe(true);
    const fams = new Set(groups.map((g) => g.family.id));
    for (const f of Object.keys(FAMILIES)) if ([...ENEMIES, ...EVENT_ENEMIES].some((e) => e.family === f)) expect(fams.has(f), f).toBe(true);
    expect(fams.has('brigade')).toBe(true);
  });
});

describe('sandbox gear is virtual', () => {
  it('a sandbox battle never writes its builds or gear into the profile', () => {
    const profile = { units: {}, gear: {}, progress: { stages: {} }, settings: {}, missions: { counters: {} } };
    const before = JSON.stringify(profile);
    const req = parseBattleParams(sandboxBattleParams({ stageId: '4-5', towers: ['tenka', 'kage'], hero: 'kogane', freeplay: 'blossom', startWave: 200 }), null);
    createBattleSim(profile, { ...req, seed: 1 });
    sandboxProfile('tenka');
    expect(JSON.stringify(profile)).toBe(before);
  });
});

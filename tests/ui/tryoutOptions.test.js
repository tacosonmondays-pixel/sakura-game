// Tryout Day's Extended Day and Random Class, the minimal UI (docs/specs/TRYOUT_DAY.md §20.7, §20.8): the length ladder
// (Extended Day opens after any Full Day clear), Before Class's options and Start reason, the co-op room's options, the
// one adapter module the UI reads the Sim through (src/ui/battle/tryout/adapters.js), the reveal's highlight (Sim ticks,
// lands on the drawn card; Reduce Motion marks it at once), Extended Day's wave count past 48 and its open-ended strip,
// and the text (no other works' names; the help line says what Random Class promises).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createProfile } from '../../src/systems/save.js';
import { TRYOUT } from '../../src/data/tryout.js';
import { RUN_LENGTHS, fullCleared, lengthOpen, halfCleared } from '../../src/systems/tryoutRuns.js';
import { TRYOUT_META } from '../../src/data/tryoutMeta.js';
import {
  isRandomRun, isExtendedRun, viewLength, revealOf, revealStep, revealTicks, extendedPast, runOptions, REVEAL_HOP_SHARE, FULL_WAVES,
} from '../../src/ui/battle/tryout/adapters.js';
import { setupOptions, startWhy, startArgs } from '../../src/ui/screens/tryoutSetup.js';
import { extendedCells, planTimetableModel } from '../../src/ui/battle/tryout/timetable.js';
import { buildTryoutPlan, mapChoices } from '../../src/sim/tryout/plan.js';
import { LENGTH_NAMES, EXTENDED_TEXT, RANDOM_TEXT, CLASS_TEXT, TIMETABLE_TEXT } from '../../src/ui/text/tryout.js';
import { scanAll } from '../../tools/cssFloor.mjs';

const withCounter = (key, n) => {
  const p = createProfile();
  p.missions = p.missions || {};
  p.missions.counters = { ...(p.missions.counters || {}), [key]: n };
  return p;
};

describe('run lengths: Half Day, Full Day, Extended Day', () => {
  it('three lengths in order, each named', () => {
    expect(RUN_LENGTHS).toEqual(['half', 'full', 'after']);
    expect(RUN_LENGTHS.map((k) => LENGTH_NAMES[k])).toEqual(['Half Day', 'Full Day', 'Extended Day']);
  });
  it('Extended Day opens after any Full Day clear (ty:full), and says so while locked', () => {
    const fresh = createProfile();
    expect(fullCleared(fresh)).toBe(false);
    expect(lengthOpen(fresh, 'half')).toEqual({ open: true, why: null });
    expect(lengthOpen(fresh, 'full')).toEqual({ open: false, why: 'half' });
    expect(lengthOpen(fresh, 'after')).toEqual({ open: false, why: 'full' });
    const half = withCounter(TRYOUT_META.keys.half, 1);
    expect(halfCleared(half)).toBe(true);
    expect(lengthOpen(half, 'full').open).toBe(true);
    expect(lengthOpen(half, 'after').open).toBe(false);
    const full = withCounter(TRYOUT_META.keys.full, 2);
    expect(fullCleared(full)).toBe(true);
    expect(lengthOpen(full, 'after')).toEqual({ open: true, why: null });
    expect(lengthOpen(full, 'evening')).toEqual({ open: false, why: 'unknown' });
    expect(EXTENDED_TEXT.locked).toMatch(/Full Day/);
  });
});

describe('Before Class options (§20.8)', () => {
  const base = { mode: 'normal', seed: 77, grade: 2, mapId: 'm', hero: 'h', pick: [], perks: {}, length: 'after', random: true };
  it('Extended Day and Random Class only on a normal day', () => {
    expect(setupOptions(base)).toEqual({ length: 'after', random: true });
    expect(setupOptions({ ...base, mode: 'weekly' })).toEqual({ length: 'half', random: false });
    expect(setupOptions({ ...base, mode: 'practice', length: 'full' })).toEqual({ length: 'full', random: false });
    expect(setupOptions({ ...base, random: 'yes' }).random).toBe(false);
  });
  it('Start needs no picks in Random Class; otherwise exactly three', () => {
    expect(startWhy(base, 3)).toBe(null);
    expect(startWhy({ ...base, random: false }, 3)).toBe(CLASS_TEXT.pickMore(3));
    expect(startWhy({ ...base, random: false, pick: ['a', 'b'] }, 3)).toBe(CLASS_TEXT.pickMore(1));
    expect(startWhy({ ...base, random: false, pick: ['a', 'b', 'c'] }, 3)).toBe(null);
  });
  it('the run record carries length after and random (no squad: the Sim draws it)', () => {
    const a = startArgs({ ...base, pick: ['a', 'b', 'c'] }, { simId: 's1' });
    expect(a).toMatchObject({ seed: 77, grade: 2, length: 'after', random: true, squad: [], simId: 's1' });
    const b = startArgs({ ...base, random: false, length: 'full', pick: ['a', 'b', 'c'] });
    expect(b.random).toBeUndefined();
    expect(b).toMatchObject({ length: 'full', squad: ['a', 'b', 'c'] });
    const w = startArgs({ ...base, mode: 'weekly', week: 9, pick: ['a', 'b', 'c'] });
    expect(w).toMatchObject({ length: 'half', weekly: 9, squad: ['a', 'b', 'c'] });
    expect(w.random).toBeUndefined();
  });
});

describe('the co-op room setting (§20.7)', () => {
  it('runOptions reads a room setting: unknown lengths are Half Day, Random Class only when exactly true', () => {
    expect(runOptions({ seed: 1, grade: 1, length: 'after', mapId: 'x', random: true })).toEqual({ length: 'after', random: true });
    expect(runOptions({ length: 'full' })).toEqual({ length: 'full', random: false });
    expect(runOptions({ length: 'night', random: 1 })).toEqual({ length: 'half', random: false });
    expect(runOptions(null)).toEqual({ length: 'half', random: false });
  });
  it('the room panel sends the options through setTryout and shows the guest a read-only line', () => {
    const src = readFileSync(resolve('src/ui/screens/coop.js'), 'utf8');
    for (const id of ['coop-run-random', 'coop-run-options', 'coop-run-length-ro', 'coop-run-random-ro']) expect(src).toContain(`'${id}'`);
    expect(src).toMatch(/RUN_LENGTHS\.map/);
    expect(src).toMatch(/lengthOpen\(store\.profile, k\)/);
  });
});

describe('the Sim adapters (src/ui/battle/tryout/adapters.js)', () => {
  const offer = { pick: 3, seq: 11, kind: 'pep', rarity: 1, credits: 2, cards: [{ id: 'A' }, { id: 'B' }, { id: 'C' }] };
  const simWith = (ty, extra = {}) => ({ wave: 8, tryout: ty, ...extra });
  it('reads the run kind from a Sim, its run state, a record or a pending config', () => {
    expect(isRandomRun(simWith({ random: true }))).toBe(true);
    expect(isRandomRun({ random: true })).toBe(true);
    expect(isRandomRun(simWith({}))).toBe(false);
    expect(isRandomRun(null)).toBe(false);
    expect(isExtendedRun({ length: 'after' })).toBe(true);
    expect(isExtendedRun(simWith({ length: 'full' }))).toBe(false);
    expect(viewLength({ length: 'after' })).toBe(TRYOUT.lengths.full);
    expect(viewLength({ length: 'half' })).toBe(TRYOUT.lengths.half);
  });
  it('revealOf uses sim.tryoutAutoPick (the drawn card, ticks left) and ignores a stale offer', () => {
    const ty = { random: true, players: [{ win: 'pick', offer: offer, winTicks: 30 }] };
    const sim = simWith(ty, { tryoutAutoPick: () => ({ owner: 0, pick: 3, seq: 11, index: 2, path: 1, card: { id: 'C' }, ticksLeft: 60, revealTicks: 120 }) });
    const r = revealOf(sim, 0);
    expect(r).toMatchObject({ pick: 3, seq: 11, index: 2, path: 1, done: 60, total: 120 });
    expect(r.progress).toBeCloseTo(0.5);
    expect(r.card).toEqual({ id: 'C' });
    const stale = simWith(ty, { tryoutAutoPick: () => ({ seq: 10, index: 1, ticksLeft: 5, revealTicks: 120 }) });
    expect(revealOf(stale, 0).index).toBe(null);
  });
  it('revealOf falls back to the window clock before the Sim exposes the draw, and is null off a random pick', () => {
    const ty = { random: true, players: [{ win: 'pick', offer, winTicks: 30 }] };
    const r = revealOf(simWith(ty), 0);
    expect(r).toMatchObject({ index: null, done: 30, total: revealTicks() });
    expect(revealOf(simWith({ ...ty, random: undefined }), 0)).toBe(null);
    expect(revealOf(simWith({ random: true, players: [{ win: 'break', offer: null }] }), 0)).toBe(null);
    expect(revealOf(simWith(ty, { tryoutAutoPick: () => { throw new Error('x'); } }), 0).index).toBe(null);
    expect(revealOf(null, 0)).toBe(null);
  });
  it('revealStep: two laps across the cards, then on to the drawn card, where it lands', () => {
    for (const index of [0, 1, 2]) {
      const seen = [];
      for (let t = 0; t <= 120; t++) seen.push(revealStep({ progress: t / 120, index }, 3));
      expect(seen[0]).toEqual({ at: 0, landed: false });
      expect(seen[120]).toEqual({ at: index, landed: true });
      const hops = seen.filter((s, i) => i && (s.at !== seen[i - 1].at)).length;
      expect(hops).toBeGreaterThanOrEqual(6 + index - 1);
      // the last stepping frame already shows the drawn card (it lands where the highlight is)
      const lastMove = seen.filter((s) => !s.landed).pop();
      expect(lastMove.at).toBe(index);
      expect(seen.findIndex((s) => s.landed)).toBe(Math.ceil(REVEAL_HOP_SHARE * 120));
    }
  });
  it('revealStep under Reduce Motion: the drawn card marked at once; nothing marked while the draw is unknown', () => {
    expect(revealStep({ progress: 0, index: 1 }, 3, { reduced: true })).toEqual({ at: 1, landed: true });
    expect(revealStep({ progress: 0.5, index: null }, 3)).toEqual({ at: -1, landed: false });
    expect(revealStep({ progress: 0.5, index: -1 }, 3)).toEqual({ at: -1, landed: false });
    expect(revealStep({ progress: 0.5, index: 4 }, 3)).toEqual({ at: -1, landed: false });
    expect(revealStep(null, 3)).toEqual({ at: -1, landed: false });
  });
  it('extendedPast: an Extended Day counts waves past the Full Day\'s 48', () => {
    expect(FULL_WAVES).toBe(48);
    expect(extendedPast(simWith({ length: 'after' }, { wave: 48 }))).toBe(null);
    expect(extendedPast(simWith({ length: 'after' }, { wave: 53 }))).toEqual({ wave: 53 });
    expect(extendedPast(simWith({ length: 'after' }), 61)).toEqual({ wave: 61 });
    expect(extendedPast(simWith({ length: 'full' }, { wave: 53 }))).toBe(null);
    expect(EXTENDED_TEXT.wave(53)).toBe('Wave 53');
  });
});

describe('Extended Day\'s Before Class strip', () => {
  it('the Full Day\'s twelve, P12 a period like the rest (not the Final)', () => {
    const seed = 4242;
    const plan = buildTryoutPlan({ seed, grade: 1, length: 'full', mapId: mapChoices(seed, 1)[0] });
    const cells = extendedCells(planTimetableModel(plan));
    const periods = cells.filter((c) => c.kind === 'period');
    expect(periods).toHaveLength(12);
    expect(periods.some((c) => c.final)).toBe(false);
    expect(periods[11].label).toBe(TIMETABLE_TEXT.cell(12));
    expect(EXTENDED_TEXT.more).toBe('P13+');
  });
});

describe('the text and the styles', () => {
  it('Random Class\'s help line says what it promises, in plain words', () => {
    expect(RANDOM_TEXT.help).toMatch(/striker/);
    expect(RANDOM_TEXT.help).toMatch(/flyers/);
    expect(RANDOM_TEXT.help).toMatch(/Control or Support girl is not promised/);
    expect(RANDOM_TEXT.helpShort).toMatch(/striker/);
    expect(RANDOM_TEXT.helpShort).toMatch(/no Control or Support promise/);
  });
  it('no style under 12 px in the Tryout stylesheets', () => {
    const files = ['src/ui/styles/tryout.css', 'src/ui/styles/tryoutBattle.css', 'src/ui/styles/tryoutTimetable.css'];
    const scan = scanAll();
    for (const f of files) expect(scan[f] || []).toEqual([]);
  });
  it('the reveal\'s Reduce Motion rules (system and in-app)', () => {
    const css = readFileSync(resolve('src/ui/styles/tryoutBattle.css'), 'utf8');
    expect(css).toMatch(/html\[data-reduce-motion\] \.ty-layer \.ty-rv-deck > \.ty-rv-on \{ transform: none; \}/);
    expect(css).toMatch(/\.ty-layer \.ty-sheet-wrap\.ty-rv-wrap \{[^}]*background: transparent/);
  });
});

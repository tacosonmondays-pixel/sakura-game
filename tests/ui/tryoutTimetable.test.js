// Tryout Day's timetable from the plan and the pick sheet's numbers (src/ui/battle/tryout/timetable.js,
// src/ui/battle/tryout/caps.js; docs/specs/TRYOUT_DAY.md §3.4, §4.4, §13.3, §13.4, §13.6): Before Class's strip model
// (Half and Full Day), a cell's preview, the cap bar through the real fold (never touching the Sim), the MORE sheet's
// odds table and caps, and the new stylesheet's scope fence, type floor and Reduce Motion.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { planTimetableModel, periodPreview, familyTraits, familyFoes, periodFoes, PREVIEW_TRAITS } from '../../src/ui/battle/tryout/timetable.js';
import { capBar, mainFamily, oddsTable, capsTable, withCard, fmtFam } from '../../src/ui/battle/tryout/caps.js';
import { buildTryoutPlan, buildTryoutStage, lengthOf } from '../../src/sim/tryout/plan.js';
import { cardMods, familySums } from '../../src/sim/tryout/pep.js';
import { rarityWeights } from '../../src/sim/tryout/offers.js';
import { Sim } from '../../src/sim/Sim.js';
import { TRYOUT, PEP_CARDS } from '../../src/data/tryout.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { scanAll } from '../../tools/cssFloor.mjs';
import { PREVIEW_TEXT, CAP_TEXT, MORE_TEXT } from '../../src/ui/text/tryout.js';

const periods = (cells) => cells.filter((c) => c.kind === 'period');

describe('Before Class timetable: the plan model (§13.3)', () => {
  it('Half Day: P1 … Final, Recess and Cleaning Time, minibosses on P3 and P6, the boss on the Final', () => {
    const plan = buildTryoutPlan({ seed: 1234, grade: 1, length: 'half' });
    const cells = planTimetableModel(plan);
    expect(cells.map((c) => (c.kind === 'break' ? c.id : c.label))).toEqual(['P1', 'P2', 'P3', 'recess', 'P4', 'P5', 'P6', 'cleaning', 'Final']);
    const ps = periods(cells);
    expect(ps.every((c) => c.state === 'upcoming' && c.marks === null && !c.dare)).toBe(true);
    expect(ps[0].subjects).toEqual([]);
    for (const c of ps.slice(1)) expect(c.subjects).toEqual(plan.subjects[c.p]);
    expect(ps.filter((c) => c.foeTier === 'miniboss').map((c) => [c.p, c.foe])).toEqual([[3, plan.minibosses[0]], [6, plan.minibosses[1]]]);
    expect(ps.at(-1)).toMatchObject({ final: true, foe: plan.boss, foeTier: 'boss' });
    // History in a pair: the Back Gate mark; below Grade 8: no affix dots
    for (const c of ps) expect(c.backGate).toBe(c.subjects.includes('subj_history'));
    expect(ps.every((c) => c.affix === null)).toBe(true);
  });
  it('Full Day: 12 periods, Recess / Lunch / Cleaning, minibosses on P3, P7 and P11, Grade 8+ affix dots from P3', () => {
    const plan = buildTryoutPlan({ seed: 99, grade: 8, length: 'full' });
    const cells = planTimetableModel(plan);
    const ps = periods(cells);
    expect(ps).toHaveLength(12);
    expect(cells.filter((c) => c.kind === 'break').map((c) => [c.after, c.id])).toEqual([[3, 'recess'], [7, 'lunch'], [11, 'cleaning']]);
    expect(ps.filter((c) => c.foeTier === 'miniboss').map((c) => c.p)).toEqual([3, 7, 11]);
    expect(ps[11]).toMatchObject({ label: 'Final', foe: plan.boss, foeTier: 'boss' });
    expect(ps.map((c) => !!c.affix)).toEqual(ps.map((c) => c.p >= TRYOUT.grades[8].affixFrom));
    for (const c of ps) if (c.affix) expect(TRYOUT.dares.map((d) => d.id)).toContain(c.affix);
  });
  it('is pure: the same plan gives the same cells, and the plan is not changed', () => {
    const plan = buildTryoutPlan({ seed: 5, grade: 3, length: 'half' });
    const before = JSON.stringify(plan);
    expect(planTimetableModel(plan)).toEqual(planTimetableModel(plan));
    expect(JSON.stringify(plan)).toBe(before);
  });
});

describe('a timetable cell\'s preview (§13.4)', () => {
  const plan = buildTryoutPlan({ seed: 777, grade: 1, length: 'half' });
  it('a period: its block\'s two families, their traits, the period\'s waves, the pair, what comes after', () => {
    const pv = periodPreview(plan, 2);
    expect(pv.families).toEqual([...new Set(plan.blocks[0].families)]);
    expect(pv.waves).toEqual([5, 8]);
    expect(pv.subjects).toEqual(plan.subjects[2]);
    expect(pv.chosen).toBeNull();
    expect(pv.pick).toEqual({ n: 2, tryout: false, exam: false });
    expect(pv.foes).toEqual([]);
    expect(periodPreview(plan, 1).pick).toMatchObject({ n: 1, tryout: true });
    expect(periodPreview(plan, 6).pick).toMatchObject({ n: 6, exam: true });
  });
  it('the miniboss on its wave, the boss on the Final, the breaks after P3 and P6', () => {
    expect(periodPreview(plan, 3).foes).toEqual([{ wave: 12, id: plan.minibosses[0], tier: 'miniboss' }]);
    expect(periodPreview(plan, 3).breakAfter).toBe('recess');
    expect(periodPreview(plan, 6).breakAfter).toBe('cleaning');
    const fin = periodPreview(plan, 7);
    expect(fin.final).toBe(true);
    expect(fin.foes).toEqual([{ wave: 28, id: plan.boss, tier: 'boss' }]);
    expect(fin.breakAfter).toBeNull();
    expect(fin.pick).toBeNull();
  });
  it('a chosen Subject replaces the pair; History brings the Back Gate', () => {
    const pv = periodPreview(plan, 4, { subjects: ['subj_history', 'subj_pe'], chosen: 'subj_history' });
    expect(pv.chosen).toBe('subj_history');
    expect(pv.backGate).toBe(true);
    expect(periodPreview(plan, 4, { subjects: ['subj_history', 'subj_pe'], chosen: 'subj_pe' }).backGate).toBe(false);
  });
  it('traits come from the families\' own enemies (flyers, veiled, heavy armour, regen, spectral)', () => {
    expect(familyFoes('spring', 'ghost').length).toBeGreaterThan(0);
    expect(familyTraits('spring', ['ghost'])).toContain('spectral');
    for (const f of TRYOUT.windows.autumn.families) {
      const t = familyTraits('autumn', [f]);
      expect(t.every((x) => PREVIEW_TRAITS.includes(x))).toBe(true);
      expect(t).toEqual(PREVIEW_TRAITS.filter((x) => t.includes(x)));
      for (const x of t) expect(PREVIEW_TEXT.traits[x]).toBeTruthy();
    }
    // the big foes' own traits count too
    const pv = periodPreview(plan, 7);
    expect(pv.traits).toEqual(familyTraits(plan.window, pv.families, [plan.boss]));
  });
  it('Full Day: the Final\'s boss on wave 48 and the minibosses on 12, 28 and 44', () => {
    const full = buildTryoutPlan({ seed: 3, grade: 4, length: 'full' });
    expect([3, 7, 11].map((p) => periodFoes(full, p)[0]?.wave)).toEqual([12, 28, 44]);
    expect(periodFoes(full, 12)).toEqual([{ wave: 48, id: full.boss, tier: 'boss' }]);
    expect(ENEMY_MAP[full.boss].tier).toBe('boss');
  });
});

function makeSim({ squad = ['aoi', 'kage', 'yuki'], hero = 'hikari' } = {}) {
  const plan = buildTryoutPlan({ seed: 4242, grade: 1, length: 'half' });
  const stage = buildTryoutStage(plan);
  return new Sim({
    stageId: stage.id, hero: hero ? { unitId: hero, stats: {} } : null, seed: 99, data: { stage },
    options: { tryout: { seed: 4242, grade: 1, length: 'half', mapId: plan.mapId, players: [{ squad }], pools: [{}] } },
  });
}

describe('the pick sheet\'s cap bar (§4.4, §13.6)', () => {
  it('a card\'s main family: its first capped number; no bar for board cards, talents and pairs', () => {
    expect(mainFamily({ id: 'E01', r: 2 })).toMatchObject({ key: 'damageMul', value: cardMods(PEP_CARDS.E01, 2).damageMul });
    expect(mainFamily({ id: 'E05', r: 0 })).toMatchObject({ key: 'classMul', cls: 'heavy' });
    expect(mainFamily({ id: 'P04', unit: 'aoi', r: 1 })).toMatchObject({ key: 'costCut' });
    for (const id of ['B01', 'B04', 'T_aoi', 'U02', 'U05', 'X02', 'P06']) expect(mainFamily({ id, unit: 'aoi', r: PEP_CARDS[id].rar[0] }), id).toBeNull();
  });
  it('One girl: now and after through the real fold, capped; the Sim is never changed', () => {
    const sim = makeSim();
    const p = sim.tryout.players[0];
    p.cards.push({ id: 'P01', unit: 'kage', r: 4 }, { id: 'P01', unit: 'kage', r: 4 });
    const before = JSON.stringify(sim.tryout);
    const inst = { id: 'P01', unit: 'kage', r: 4 };
    const bar = capBar(sim, 0, inst);
    const sum = familySums(sim, 0, 'kage', false).damageMul;
    const v = cardMods(PEP_CARDS.P01, 4).damageMul;
    expect(bar).toMatchObject({ key: 'damageMul', who: 'kage', hero: false, cap: TRYOUT.caps.damageMul, of: 1 });
    expect(bar.now).toBeCloseTo(Math.min(1, sum));
    expect(bar.after).toBeCloseTo(Math.min(1, sum + v));
    expect(bar.text).toBe(CAP_TEXT.label('Damage', fmtFam('pct', bar.now), fmtFam('pct', bar.after), '100%'));
    expect(JSON.stringify(sim.tryout)).toBe(before);
    expect(p.cards).toHaveLength(2);
  });
  it('Team: the girl the cap cuts most, and on how many it adds in full', () => {
    const sim = makeSim();
    const p = sim.tryout.players[0];
    // Kage near her damage cap: Big Breakfast gives the others its full value, her only the room left
    for (let i = 0; i < 4; i++) p.cards.push({ id: 'P01', unit: 'kage', r: 4 });
    const bar = capBar(sim, 0, { id: 'E01', r: 4 });
    expect(bar.who).toBe('kage');
    expect(bar.after).toBeCloseTo(1);
    expect(bar.of).toBe(4); // three girls and the hero
    expect(bar.full).toBe(3);
  });
  it('a placement card shows what it gives once the placement holds', () => {
    const bar = capBar(makeSim(), 0, { id: 'L02', r: 1 });
    expect(bar.key).toBe('damageMul');
    expect(bar.after - bar.now).toBeCloseTo(cardMods(PEP_CARDS.L02, 1).damageMul);
  });
  it('the view adds the card for the fold only', () => {
    const sim = makeSim();
    const v = withCard(sim, 0, { id: 'E01', r: 0 });
    expect(v.tryout.players[0].cards).toHaveLength(1);
    expect(sim.tryout.players[0].cards).toHaveLength(0);
  });
});

describe('the pick sheet\'s MORE: odds and caps (§3.4, §4.4)', () => {
  it('every credit row of the band with this pick\'s floor and the LR cap, the held credits marked', () => {
    const rows = oddsTable({ band: 'mid', credits: 2, floor: 1, lrOff: true });
    expect(rows).toHaveLength(TRYOUT.creditsMax + 1);
    expect(rows.filter((r) => r.current).map((r) => r.credits)).toEqual([2]);
    for (const r of rows) {
      const w = rarityWeights('mid', r.credits, 1, true);
      const tot = w.reduce((a, b) => a + b, 0);
      expect(r.pct).toEqual(w.map((x) => Math.round((100 * x) / tot)));
      expect(r.pct[0]).toBe(0); // (the floor: at least SR)
      expect(r.pct[4]).toBe(0); // (LR taken: an LR roll becomes UR)
    }
    expect(oddsTable({ band: 'early', credits: 0 })[0].pct).toEqual(TRYOUT.odds.early[0]);
  });
  it('the caps table: the §4.4 families with their caps, and the highest value a girl has now', () => {
    const sim = makeSim();
    sim.tryout.players[0].cards.push({ id: 'P01', unit: 'kage', r: 2 });
    const rows = capsTable(sim, 0);
    expect(rows.map((r) => r.id)).toEqual(['damageMul', 'rateMul', 'range', 'crit', 'hits', 'splash', 'vs', 'costCut', 'runDamage']);
    expect(rows.map((r) => r.cap)).toEqual(['+100%', '+50%', '+0.5 tiles', '+10 / +0.25', '+1 / +1 / +2', '+0.25 tiles', '+30%', '−30%', '×2.5']);
    expect(rows[0]).toMatchObject({ who: 'Kage', top: fmtFam('pct', cardMods(PEP_CARDS.P01, 2).damageMul) });
    expect(rows.find((r) => r.id === 'runDamage').who).toBe('Kage');
    expect(rows.find((r) => r.id === 'rateMul').top).toBeNull();
    for (const r of rows) expect(MORE_TEXT.rows[r.id], r.id).toBeTruthy();
  });
});

describe('tryoutTimetable.css: scope, type floor, Reduce Motion', () => {
  const CSS = readFileSync(resolve('src/ui/styles/tryoutTimetable.css'), 'utf8');
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  it('no declaration under 12 px', () => {
    expect(scanAll()['src/ui/styles/tryoutTimetable.css']).toEqual([]);
  });
  it('every rule sits under its own classes (.ty-tt.live, .ty-ttw, .ty-ttp, .ty-bct)', () => {
    const flat = body.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@media[^{]*\{/g, '');
    const sels = [...flat.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter(Boolean).flatMap((s) => s.split(/,(?![^(]*\))/).map((x) => x.trim()));
    expect(sels.length).toBeGreaterThan(20);
    const bad = sels.filter((x) => !/^(html\[data-reduce-motion\]\s+)?\.ty-(tt\.live|ttw|ttp|bct)\b/.test(x));
    expect(bad).toEqual([]);
  });
  it('the preview card\'s drop is held still under both Reduce Motion switches', () => {
    expect(body.slice(body.indexOf('prefers-reduced-motion'))).toMatch(/\.ty-ttp\s*\{[^}]*animation:\s*none/);
    expect(body).toMatch(/html\[data-reduce-motion\]\s+\.ty-ttp\s*\{[^}]*animation:\s*none/);
  });
  it('no rainbow or Nightglass', () => {
    expect(body).not.toMatch(/ur-rainbow|conic-gradient|nightglass|comet/i);
  });
});

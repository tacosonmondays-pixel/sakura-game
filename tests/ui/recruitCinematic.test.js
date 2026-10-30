// The recruit cinematic (docs/RECRUIT_CINEMATIC.md): its timeline from the pull and the comfort settings, the
// marks, and that it stays display only (no save writes, no wall clock, no unseeded randomness, no sim files).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  planCinematic, gateAt, gatePhaseStart, revealAt, revealHoldStart, revealStars, GATE_TIMES, GATE_TIMES_CALM, REVEAL_TIMES, GATE_PHASES,
  openLightPeak, openLightFade, OPEN_FADE, idleGateEnergy,
} from '../../src/ui/recruit/plan.js';
import { FlashGuard, FAINT, SOFT_FLASH, MAX_FLASH } from '../../src/render/vfx/flashGuard.js';
import { compact } from '../../src/ui/recruit/fx.js';
import { markRecipe, markSVG, MARK_SHAPES } from '../../src/ui/recruit/emblem.js';
import { UNIT_MAP, UNITS } from '../../src/data/units.js';
import { unitClass } from '../../src/data/banners.js';

const isLegend = (id) => unitClass(id) === 'legend';
const R = (unitId, rarity) => ({ unitId, rarity });
const tenR = Array.from({ length: 10 }, () => R('mio', 'R'));

describe('planCinematic', () => {
  it('no SSR: the blue Gate (gold sparks with an SR), no shake, no arcs, no reveals', () => {
    const p = planCinematic(tenR, { isLegend });
    expect(p.tier).toBe('blue');
    expect(p.accent).toBe(null);
    expect(p.shake).toBe(false);
    expect(p.arcs).toBe(false);
    expect(p.reveals).toEqual([]);
    expect(planCinematic([...tenR.slice(1), R('mio', 'SR')], { isLegend }).accent).toBe('gold');
  });

  it('an SSR: the rainbow surge with shake, flashes and arcs, one reveal per SSR in pull order', () => {
    const res = [R('mio', 'R'), R('hikari', 'SSR'), R('mio', 'SR'), R('luna', 'SSR')];
    const p = planCinematic(res, { isLegend });
    expect(p.tier).toBe('rainbow');
    expect([p.shake, p.flashes, p.arcs]).toEqual([true, true, true]);
    expect(p.reveals.map((r) => [r.index, r.unitId, r.lr])).toEqual([[1, 'hikari', false], [3, 'luna', false]]);
    expect(p.reveals[0].times).toBe(REVEAL_TIMES.ssr);
    expect(p.gate.total).toBeCloseTo(GATE_TIMES.rainbow.power + GATE_TIMES.rainbow.surge + GATE_TIMES.rainbow.open);
  });

  it('an LR: the longer starlit version, and her own longer reveal', () => {
    const p = planCinematic([R('hikari', 'SSR'), R('tenka', 'SSR')], { isLegend });
    expect(p.tier).toBe('lr');
    expect(p.gate.night).toBeGreaterThan(0);
    expect(p.gate.total).toBeGreaterThan(planCinematic([R('hikari', 'SSR')], { isLegend }).gate.total + 1);
    expect(p.reveals.map((r) => r.lr)).toEqual([false, true]);
    expect(p.reveals[1].times).toBe(REVEAL_TIMES.lr);
    expect(revealHoldStart(REVEAL_TIMES.lr)).toBeGreaterThan(revealHoldStart(REVEAL_TIMES.ssr));
    expect([revealStars(false), revealStars(true)]).toEqual([5, 6]);
  });

  it('Reduce motion: the calm version (no shake, flashes or arcs; short)', () => {
    for (const res of [tenR, [R('hikari', 'SSR')], [R('tenka', 'SSR')]]) {
      const p = planCinematic(res, { isLegend, reduce: true });
      expect([p.shake, p.flashes, p.arcs]).toEqual([false, false, false]);
      expect(p.gate.total).toBeLessThanOrEqual(2.2);
      for (const r of p.reveals) expect(r.times).toBe(REVEAL_TIMES.calm);
    }
    expect(GATE_TIMES_CALM.lr.night).toBeLessThan(GATE_TIMES.lr.night);
  });

  it('Flashes & shake off: no shake and no flashes, the arcs and rainbow stay', () => {
    const p = planCinematic([R('hikari', 'SSR')], { isLegend, effects: false });
    expect([p.tier, p.shake, p.flashes, p.arcs]).toEqual(['rainbow', false, false, true]);
  });

  it('skipGate (a spark): no Gate, the reveal still plays', () => {
    const p = planCinematic([R('hikari', 'SSR')], { isLegend, skipGate: true });
    expect(p.gate).toBe(null);
    expect(p.reveals).toHaveLength(1);
  });

  it('never changes the results it is given', () => {
    const res = [R('hikari', 'SSR'), R('tenka', 'SSR'), R('mio', 'R')];
    const before = JSON.stringify(res);
    planCinematic(res, { isLegend });
    expect(JSON.stringify(res)).toBe(before);
  });
});

describe('the Gate and reveal clocks', () => {
  const gate = planCinematic([R('tenka', 'SSR')], { isLegend }).gate;

  it('walks the phases in order and ends done', () => {
    const seen = [];
    for (let t = 0; t <= gate.total + 0.1; t += 0.05) {
      const { phase } = gateAt(gate, t);
      if (seen[seen.length - 1] !== phase) seen.push(phase);
    }
    expect(seen).toEqual([...GATE_PHASES, 'done']);
  });

  it('skips a phase of no length (the blue Gate has no surge)', () => {
    const blue = planCinematic(tenR, { isLegend }).gate;
    expect(gateAt(blue, GATE_TIMES.blue.power + 0.01).phase).toBe('open');
    expect(gatePhaseStart(blue, 'open')).toBeCloseTo(GATE_TIMES.blue.power);
  });

  it('the reveal: silhouette → sweep → text → mark → hold → done', () => {
    const t = REVEAL_TIMES.ssr;
    expect(revealAt(t, 0).stage).toBe('silhouette');
    expect(revealAt(t, t.silhouette + 0.01).stage).toBe('sweep');
    expect(revealAt(t, revealHoldStart(t) + 0.01).stage).toBe('hold');
    expect(revealAt(t, revealHoldStart(t) + t.hold + 0.01).stage).toBe('done');
    // the calm one starts with the sweep (a fade): no silhouette stage
    expect(revealAt(REVEAL_TIMES.calm, 0).stage).toBe('sweep');
  });
});

describe('the opening light (a full-screen light: one flash)', () => {
  const caps = { faint: FAINT, soft: SOFT_FLASH };
  const res = [R('hikari', 'SSR')];

  it('Flashes & shake off: faint, and the guard is never asked', () => {
    let asked = 0;
    for (const reduce of [false, true]) {
      const p = planCinematic(res, { isLegend, effects: false, reduce });
      expect(openLightPeak(p, () => { asked++; return 1; }, caps)).toBeLessThanOrEqual(FAINT);
    }
    expect(asked).toBe(0);
  });

  it('Reduce motion: at most the soft flash', () => {
    const p = planCinematic(res, { isLegend, reduce: true });
    expect(openLightPeak(p, () => 1, caps)).toBeLessThanOrEqual(SOFT_FLASH);
  });

  it('otherwise the flash guard decides, and it is counted as one flash', () => {
    const p = planCinematic(res, { isLegend });
    const guard = new FlashGuard();
    const peak = openLightPeak(p, (want) => guard.flash(want, 1), caps);
    expect(peak).toBeGreaterThan(FAINT);
    expect(peak).toBeLessThanOrEqual(MAX_FLASH);
    expect(guard.times.length).toBe(1);
  });

  it('fades out over OPEN_FADE once open (never a cut)', () => {
    expect(openLightFade(0.5, 0)).toBe(0.5);
    expect(openLightFade(0.5, OPEN_FADE / 2)).toBeCloseTo(0.25);
    expect(openLightFade(0.5, OPEN_FADE)).toBe(0);
    expect(openLightFade(0.5, OPEN_FADE * 3)).toBe(0);
  });
});

describe('the Gate after it opens', () => {
  it('its glow eases from full to resting over OPEN_FADE (no one-frame drop)', () => {
    expect(idleGateEnergy(0)).toBe(1);
    expect(idleGateEnergy(OPEN_FADE / 2)).toBeCloseTo(0.75);
    expect(idleGateEnergy(OPEN_FADE)).toBe(0.5);
    expect(idleGateEnergy(10)).toBe(0.5);
    expect(idleGateEnergy(null)).toBe(0.5);
    // frame to frame at 60 fps it never moves more than a frame's share of the fade
    for (let t = 0; t < OPEN_FADE + 0.1; t += 1 / 60) expect(Math.abs(idleGateEnergy(t + 1 / 60) - idleGateEnergy(t))).toBeLessThanOrEqual(0.5 / (OPEN_FADE * 60) + 1e-9);
  });
});

describe('effects pools', () => {
  it('compact keeps the survivors in place, in order', () => {
    const arr = [1, 2, 3, 4, 5, 6];
    const same = arr;
    compact(arr, (v) => v % 2 === 0);
    expect(arr).toBe(same);
    expect(arr).toEqual([2, 4, 6]);
  });
});

describe('marks', () => {
  const ssrs = UNITS.filter((u) => u.rarity === 'SSR');

  it('the same girl always gets the same mark; marks differ between girls', () => {
    const a = markRecipe(UNIT_MAP.hikari);
    expect(markRecipe(UNIT_MAP.hikari)).toEqual(a);
    expect(MARK_SHAPES).toContain(a.shape);
    const keys = new Set(ssrs.map((u) => { const r = markRecipe(u); return `${r.points}|${r.shape}|${r.main}|${r.glyph}`; }));
    expect(keys.size).toBe(ssrs.length);
  });

  it('wears her colours and role, and LR units the Nightglass mark', () => {
    const r = markRecipe(UNIT_MAP.hikari);
    expect(r.main).toBe(UNIT_MAP.hikari.palette.hair);
    expect(r.glyph).toBe(UNIT_MAP.hikari.role);
    const lr = markRecipe(UNIT_MAP.tenka, { lr: true });
    expect([lr.lr, lr.points, lr.main]).toEqual([true, 12, '#ffd27a']);
  });

  it('draws a valid SVG for every SSR and LR girl, with unique gradient ids', () => {
    for (const u of ssrs) {
      const s = markSVG(u, { lr: isLegend(u.id), label: `${u.name}'s mark` });
      expect(s.startsWith('<svg') && s.endsWith('</svg>')).toBe(true);
      expect(s).not.toMatch(/NaN|undefined/);
    }
    const ids = [markSVG(UNIT_MAP.hikari), markSVG(UNIT_MAP.hikari)].map((s) => s.match(/id="([^"]+)-d"/)[1]);
    expect(ids[0]).not.toBe(ids[1]);
  });
});

describe('display only', () => {
  const dir = new URL('../../src/ui/recruit/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const src = files.map((f) => [f, readFileSync(new URL(f, dir), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')]);

  it('no wall clock, no unseeded randomness, no save writes', () => {
    for (const [f, s] of src) {
      expect(s, f).not.toMatch(/Math\.random|Date\.now|performance\.now/);
      expect(s, f).not.toMatch(/store\.|commit\(|saveNow|localStorage/);
      expect(s, f).not.toMatch(/systems\/gacha|from '\.\.\/\.\.\/sim/);
    }
  });

  it('the sim id does not hash the cinematic', async () => {
    const simIdSrc = readFileSync(new URL('../../tools/simId.mjs', import.meta.url), 'utf8');
    expect(simIdSrc).not.toMatch(/src\/ui/);
  });
});

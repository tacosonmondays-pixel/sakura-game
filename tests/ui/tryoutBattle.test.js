// Tryout Day M3 in battle (src/ui/battle/tryout.js, src/ui/battle/tryout/timetable.js, src/ui/styles/tryoutBattle.css;
// docs/specs/TRYOUT_DAY.md §13.1, §13.4, §13.9): the timetable strip's model and band, the Stationery ladder's tokens
// (never rainbow or Nightglass on a card), the stylesheet's scope fence and type floor, and every named import exists.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { timetableModel, bandParts, currentPeriod } from '../../src/ui/battle/tryout/timetable.js';
import { lengthOf } from '../../src/sim/tryout/plan.js';
import { scanAll } from '../../tools/cssFloor.mjs';
import { SUBJECT_TEXT, SUBJECT_ABBR, PHOTO_TEXT, GIRL_CARD_TEXT, TIMETABLE_TEXT } from '../../src/ui/text/tryout.js';

const CSS = readFileSync(resolve('src/ui/styles/tryoutBattle.css'), 'utf8');
const half = lengthOf('half');

/** A sim.tryout in a given state (only the fields the strip reads). */
function ty(o = {}) {
  return {
    done: false, period: 1, started: 0, base: null, subject: null, nextSubject: null, dare: null,
    subjects: [null, null, ['subj_music', 'subj_geo'], ['subj_lit', 'subj_shop'], ['subj_history', 'subj_pe'], ['subj_night', 'subj_art'], ['subj_homeec', 'subj_art'], ['subj_science', 'subj_winter']],
    affixes: [null, null, null, null, 'regen', null, null, null],
    periods: [], players: [{ dare: false }], ...o,
  };
}
const rec = (period, sts, extra = {}) => ({ period, score: 100, team: [['a_hearts', sts[0]], ['a_ace', sts[1]]], own: [[['a_star', sts[2]]]], resumed: false, subject: null, dare: null, ...extra });

describe('timetable strip: the model (§13.4)', () => {
  it('Half Day: P1 … Final with Recess after P3 and Cleaning Time after P6', () => {
    const cells = timetableModel(ty(), half);
    expect(cells.map((c) => (c.kind === 'break' ? c.id : c.label))).toEqual(['P1', 'P2', 'P3', 'recess', 'P4', 'P5', 'P6', 'cleaning', 'Final']);
    expect(cells.at(-1).final).toBe(true);
  });
  it('Full Day: 12 periods and its three breaks', () => {
    const cells = timetableModel(ty({ subjects: [], affixes: [] }), lengthOf('full'));
    expect(cells.filter((c) => c.kind === 'period')).toHaveLength(12);
    expect(cells.filter((c) => c.kind === 'break').map((c) => c.id)).toEqual(['recess', 'lunch', 'cleaning']);
  });
  it('states: done, current (the period in play), upcoming; a done period shows its 3 marks', () => {
    const t = ty({ period: 3, started: 3, base: {}, subject: 'subj_lit', periods: [rec(1, [1, -1, 1]), rec(2, [1, 1, 1], { subject: 'subj_geo' })] });
    const cells = timetableModel(t, half).filter((c) => c.kind === 'period');
    expect(cells.map((c) => c.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
    expect(cells[0].marks).toEqual([1, -1, 1]);
    expect(cells[1].subjects).toEqual(['subj_geo']);
    expect(cells[2].subjects).toEqual(['subj_lit']);
    expect(cells[3].marks).toBeNull();
  });
  it('between periods the coming one is current, with the pair until a Subject is chosen; History carries the Back Gate', () => {
    const t = ty({ period: 3, started: 3, periods: [rec(1, [1, 1, 1]), rec(2, [1, 1, 1]), rec(3, [1, 1, 1])] });
    expect(currentPeriod(t, half)).toBe(4);
    let p4 = timetableModel(t, half).find((c) => c.p === 4);
    expect(p4.state).toBe('current');
    expect(p4.subjects).toEqual(['subj_history', 'subj_pe']);
    expect(p4.backGate).toBe(true);
    expect(p4.affix).toBe('regen');
    p4 = timetableModel({ ...t, nextSubject: 'subj_pe', players: [{ dare: true }] }, half).find((c) => c.p === 4);
    expect(p4.subjects).toEqual(['subj_pe']);
    expect(p4.backGate).toBe(false);
    expect(p4.dare).toBe(true);
  });
  it('a break is current while it is open and done once it closed', () => {
    const t = ty({ period: 3, started: 3, periods: [rec(1, [1, 1, 1]), rec(2, [1, 1, 1]), rec(3, [1, 1, 1])] });
    const recess = (o) => timetableModel(t, half, o).find((c) => c.kind === 'break' && c.after === 3).state;
    expect(recess({ win: 'pick' })).toBe('upcoming');
    expect(recess({ win: 'break' })).toBe('current');
    expect(recess({ win: null })).toBe('done');
  });
  it('a finished run: every cell done', () => {
    const cells = timetableModel(ty({ done: true, period: 7, started: 7 }), half);
    expect(cells.every((c) => c.state === 'done')).toBe(true);
  });
});

describe('timetable strip: the thin band ("P3 · wave 2/4 · Science")', () => {
  it('in play: the period, the wave of the period, the Subject', () => {
    const b = bandParts(ty({ period: 3, started: 3, base: {}, subject: 'subj_science' }), half, 10);
    expect([b.label, b.wave, b.subject]).toEqual(['P3', 'wave 2/4', SUBJECT_TEXT.subj_science.name]);
  });
  it('between periods: the coming period, no wave; the last is the Final', () => {
    expect(bandParts(ty({ period: 2, started: 2 }), half, 8)).toMatchObject({ label: 'P3', wave: null, next: true });
    expect(bandParts(ty({ period: 7, started: 7, base: {} }), half, 26).label).toBe('Final');
  });
  it('every Subject has its cell letters', () => {
    for (const id of Object.keys(SUBJECT_TEXT)) expect(SUBJECT_ABBR[id], id).toBeTruthy();
    // (display text, never in hashed data: a wording fix never forces a co-op update)
    expect([PHOTO_TEXT.title, PHOTO_TEXT.defeat, GIRL_CARD_TEXT.varsity, TIMETABLE_TEXT.final]).toEqual(['Class Photo', 'Early Dismissal', 'Varsity', 'Final']);
  });
});

describe('tryoutBattle.css: the Stationery ladder and the scope fence (§13.1)', () => {
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  it('the five Pep Talk frame tokens are defined', () => {
    for (const r of ['r', 'sr', 'ssr', 'ur', 'lr']) expect(body).toMatch(new RegExp(`--pep-${r}:`));
  });
  it('never rainbow or Nightglass on a card', () => {
    expect(body).not.toMatch(/ur-rainbow|conic-gradient|nightglass|comet/i);
  });
  it('the UR glint plays once and is held still under Reduce Motion', () => {
    expect(body).toMatch(/\.ty-glint[^{]*\{[^}]*animation:[^;}]*\b1\b[^;}]*both/);
    const rm = body.slice(body.indexOf('prefers-reduced-motion'));
    expect(rm).toMatch(/\.ty-glint\s*\{[^}]*animation:\s*none/);
  });
  it('every rule sits under .ty-layer (nothing reaches the menus)', () => {
    const flat = body.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@media[^{]*\{/g, '');
    const sels = [...flat.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter(Boolean);
    expect(sels.length).toBeGreaterThan(50);
    // (split on the top-level commas only: an :is(a, b) stays one selector)
    const split = (sel) => {
      const out = [''];
      let depth = 0;
      for (const ch of sel) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && !depth) out.push('');
        else out[out.length - 1] += ch;
      }
      return out.map((x) => x.trim());
    };
    const bad = sels.flatMap(split).filter((x) => x && !x.startsWith('.ty-layer'));
    expect(bad).toEqual([]);
  });
  it('a new stylesheet: no declaration under 12 px', () => {
    expect(scanAll()['src/ui/styles/tryoutBattle.css']).toEqual([]);
  });
  it('a missed assignment is grey ink, never red', () => {
    const strike = body.match(/\.ty-mk\.x\s*\{([^}]*)\}/)[1];
    expect(strike).not.toMatch(/red|bad|#[cdef][0-9a-f]0{2}/i);
  });
});

describe('the in-battle Tryout modules import only what exists', () => {
  for (const file of ['src/ui/battle/tryout.js', 'src/ui/battle/tryout/timetable.js']) {
    it(file, async () => {
      const src = readFileSync(resolve(file), 'utf8');
      const missing = [];
      for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/g)) {
        const path = resolve(dirname(resolve(file)), m[2]);
        if (!path.endsWith('.js')) continue;
        const mod = await import(path);
        for (const raw of m[1].split(',')) {
          const name = raw.trim().split(/\s+as\s+/)[0].trim();
          if (name && !(name in mod)) missing.push(`${name} from ${m[2]}`);
        }
      }
      expect(missing).toEqual([]);
    });
  }
});

// Tryout Day: the Pep Talks taken (src/ui/battle/tryout/pepTalks.js, the Yearbook's card page in
// src/ui/screens/tryoutYearbook.js): the list's stacks and tiers, the drawbacks (every card with a drawback in the run
// table has its line, and the line matches the card's own effect text), Varsity and the Desk Supplies.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pepLedger, drawbacksOf, varsityOf, deskOf } from '../../src/ui/battle/tryout/pepTalks.js';
import { cardPage } from '../../src/ui/screens/tryoutYearbook.js';
import { PEP_CARDS, RARITIES } from '../../src/data/tryout.js';
import { DRAWBACK_TEXT, PEP_LIST_TEXT, cardText } from '../../src/ui/text/tryout.js';
import { UNIT_MAP } from '../../src/data/units.js';

const girl = Object.keys(UNIT_MAP).find((id) => !UNIT_MAP[id].isHero);

describe('pepLedger: one row per card (per girl for a One girl card), stacks and tiers', () => {
  it('keeps the order taken and stacks the same card', () => {
    const rows = pepLedger([{ id: 'E01', r: 0 }, { id: 'E02', r: 1 }, { id: 'E01', r: 0 }]);
    expect(rows.map((r) => [r.id, r.n])).toEqual([['E01', 2], ['E02', 1]]);
    expect(rows[0].tiers).toEqual([{ r: 0, n: 2, line: cardText({ id: 'E01', r: 0 }).line }]);
    expect(rows[0].name).toBe('Big Breakfast');
  });
  it('a stack of two rarities: one line each, the highest first; top is the highest', () => {
    const [row] = pepLedger([{ id: 'E01', r: 0 }, { id: 'E01', r: 2 }]);
    expect(row.n).toBe(2);
    expect(row.top).toBe(2);
    expect(row.tiers.map((t) => t.r)).toEqual([2, 0]);
    expect(row.tiers[0].line).not.toBe(row.tiers[1].line);
  });
  it('a One girl card is its own row per girl, and its line names her', () => {
    const other = Object.keys(UNIT_MAP).find((id) => id !== girl && !UNIT_MAP[id].isHero);
    const rows = pepLedger([{ id: 'P01', r: 1, unit: girl }, { id: 'P01', r: 1, unit: other }, { id: 'P01', r: 1, unit: girl }]);
    expect(rows.map((r) => [r.unit, r.n])).toEqual([[girl, 2], [other, 1]]);
    expect(rows[0].tiers[0].line).toContain(UNIT_MAP[girl].name);
  });
  it('Free Refills: the upgrades still free', () => {
    const [row] = pepLedger([{ id: 'P06', r: 2, unit: girl }], { refills: { [girl]: 1 } });
    expect(row.refills).toBe(1);
    expect(pepLedger([{ id: 'E01', r: 0 }])[0].refills).toBeNull();
  });
  it('ignores junk and unknown cards; clamps a rarity', () => {
    expect(pepLedger(null)).toEqual([]);
    expect(pepLedger([null, 3, { id: 'nope', r: 0 }])).toEqual([]);
    expect(pepLedger([{ id: 'E01', r: 9 }])[0].top).toBe(RARITIES.length - 1);
  });
  it('Team-wide cards are marked (shown in co-op)', () => {
    const rows = pepLedger([{ id: 'B04', r: 1 }, { id: 'B02', r: 0 }, { id: 'E01', r: 0 }]);
    expect(rows.map((r) => r.team)).toEqual([true, true, false]);
  });
});

describe('drawbacks', () => {
  it('every card with a drawback in the run table has a drawback line (U05\'s two-card pick is a boon)', () => {
    const want = Object.keys(PEP_CARDS).filter((id) => {
      const d = PEP_CARDS[id].draw;
      return (d && Object.keys(d).some((k) => k !== 'nextCards')) || PEP_CARDS[id].firstWave;
    });
    for (const id of want) expect(DRAWBACK_TEXT[id], id).toBeTypeOf('function');
    for (const id of Object.keys(DRAWBACK_TEXT)) expect(PEP_CARDS[id], id).toBeTruthy();
  });
  it('a drawback line says what the card\'s own effect line says (the same numbers)', () => {
    for (const id of Object.keys(DRAWBACK_TEXT)) {
      const line = cardText({ id, r: PEP_CARDS[id].rar.at(-1) }).line;
      const nums = DRAWBACK_TEXT[id]().match(/\d+/g) || [];
      for (const n of nums) expect(line, `${id}: ${n}`).toContain(n);
    }
  });
  it('drawbacksOf: once per card, in the order taken', () => {
    const d = drawbacksOf([{ id: 'X01', r: 4 }, { id: 'E01', r: 0 }, { id: 'U01', r: 3 }, { id: 'X01', r: 4 }]);
    expect(d.map((x) => x.id)).toEqual(['X01', 'U01']);
    expect(d[0].name).toBe('Hundred Points');
    expect(drawbacksOf(undefined)).toEqual([]);
  });
});

describe('Varsity and the Desk Supplies', () => {
  it('varsityOf: one line per girl with Varsity', () => {
    const v = varsityOf({ [girl]: true, nobody: true });
    expect(v).toHaveLength(1);
    expect(v[0].name).toBe(UNIT_MAP[girl].name);
    expect(v[0].line).toMatch(/\d+% damage/);
    expect(varsityOf(null)).toEqual([]);
  });
  it('deskOf: the switched-on supplies only', () => {
    expect(deskOf({ eraser: true, coins: false, pocket: true }).map((d) => d.id)).toEqual(['eraser', 'pocket']);
    expect(deskOf(null)).toEqual([]);
  });
});

describe('the Yearbook\'s card page', () => {
  it('a row per rarity the card comes in; a One girl card names no girl', () => {
    const pg = cardPage('P01');
    expect(pg.rows.map((r) => r.rarity)).toEqual(PEP_CARDS.P01.rar.map((r) => RARITIES[r]));
    expect(pg.rows[0].line.startsWith(PEP_LIST_TEXT.yearbookWho)).toBe(true);
    expect(pg.drawback).toBeNull();
    expect(cardPage('X01').drawback).toBe(DRAWBACK_TEXT.X01());
  });
  it('a Hidden Talent names her', () => {
    const id = Object.keys(PEP_CARDS).find((k) => PEP_CARDS[k].group === 'talent' && PEP_CARDS[k].ship);
    expect(cardPage(id).rows[0].line).toContain(UNIT_MAP[PEP_CARDS[id].unit].name);
  });
});

describe('the battle layer wears the kit', () => {
  const JS = readFileSync(resolve('src/ui/battle/tryout.js'), 'utf8');
  it('no battle-only buttons left in the Tryout layer (the kit\'s .ui-btn / .ui-opt instead)', () => {
    expect(JS).not.toMatch(/bt-btn|bt-cta/);
    expect(JS).toMatch(/div\.ty-layer\.ui-day/);
  });
  it('the Pep Talks button sits on the tracker, the pick sheet, the break bar and the Class Photo', () => {
    for (const id of ['ty-peps-open', 'ty-peps-pick', 'ty-peps-break', 'ty-peps-photo']) expect(JS).toContain(`'${id}'`);
  });
});

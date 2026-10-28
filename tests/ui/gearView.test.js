// The girl page's gear facts (src/ui/gearView.js, docs/specs/UI_DIRECTION.md §5.2, §6.2): the gear-totals strip is
// her role's three stats, gear share only, read the same way the battle reads them; a piece's strip is its main stat
// and two best substats; the comparison, her club set and the next growth.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { gearShare, gearStripCells, gearTotalsRows, pieceSummary, compareDeltas, setView, nextGrowth, idleTrickText } from '../../src/ui/gearView.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { newUnitState } from '../../src/systems/save.js';
import { rollGear, addGear, equipGear, gearFillIn } from '../../src/systems/gear.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { createRng } from '../../src/core/rng.js';

const profile = () => {
  const p = { units: {}, gear: {}, items: {}, currencies: { coins: 0, gems: 0 }, missions: { counters: {} } };
  for (const u of UNITS) p.units[u.id] = Object.assign(newUnitState(), { level: 30, breakthrough: 2 });
  return p;
};
let seed = 1;
const wear = (p, unitId, slot, o) => {
  const uid = addGear(p, rollGear(createRng(seed++), { slot, ...o }));
  equipGear(p, unitId, uid);
  return p.gear[uid];
};
const dress = (p, unitId, o = { rarity: 'legendary', level: 8 }) => ['charm', 'ribbon', 'shoes'].map((slot) => wear(p, unitId, slot, o));

describe('gearStripCells', () => {
  it('her role\'s three stats: heroes ATK RATE HASTE (Skill Haste), shooters ATK RATE RANGE, supports BUFF RANGE COST, income COST RANGE ATK', () => {
    const p = profile();
    const labels = (id) => gearStripCells(UNIT_MAP[id], p).map((c) => c.label).join(' ');
    expect(labels('hikari')).toBe('ATK RATE HASTE');
    expect(gearStripCells(UNIT_MAP.hikari, p)[2].title).toMatch(/Skill Haste/);
    expect(labels('aoi')).toBe('ATK RATE RANGE');
    expect(labels('miko')).toBe('BUFF RANGE COST');
    expect(labels('momo')).toBe('COST RANGE ATK');
    for (const u of UNITS) expect(gearStripCells(u, p), u.id).toHaveLength(3);
  });

  it('no gear: a dash, never a zero (P7)', () => {
    const cells = gearStripCells(UNIT_MAP.aoi, profile());
    expect(cells.map((c) => c.value)).toEqual(['–', '–', '–']);
    expect(cells.every((c) => !/\d/.test(c.value))).toBe(true);
  });

  it('gear share as the battle reads it: ATK with its fill-in, Range capped with MAX', () => {
    const p = profile();
    dress(p, 'chika', { rarity: 'legendary', level: 10 });
    const share = gearShare(p, 'chika');
    const b = unitBattleStats(p, 'chika');
    const fill = gearFillIn(p, 'chika');
    expect(share.atkPct.value).toBeCloseTo(share.atkPct.raw + (fill.target === 'atk' ? fill.total : 0), 4);
    expect(1 + share.rangePct.value).toBeCloseTo(b.rangeMul, 3);
    // the same girl with no gear: what is left of the battle multipliers is the gear share
    const bare = unitBattleStats(profile(), 'chika');
    expect(1 + share.ratePct.value).toBeCloseTo(b.rateMul / bare.rateMul, 3);
    expect(1 + share.atkPct.value).toBeCloseTo(b.damageMul / bare.damageMul, 3);
    // a stat over its cap says MAX
    p.gear[p.units.chika.gear.ribbon].main = { stat: 'rangePct', value: 0.9 };
    const range = gearStripCells(UNIT_MAP.chika, p).find((c) => c.stat === 'rangePct');
    expect([range.value, range.unit]).toEqual(['+50%', 'MAX']);
  });

  it('every total for Details: only what gear gives, each with its cap', () => {
    const p = profile();
    dress(p, 'aoi');
    const rows = gearTotalsRows(p, 'aoi');
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.every((r) => /^\+/.test(r.value))).toBe(true);
    expect(rows.find((r) => r.stat === 'critChance')?.cap).toBe('+75%');
  });
});

describe('pieceSummary', () => {
  it('a piece\'s strip: its main stat, then its two best substats; a Common piece has only its main stat', () => {
    const p = profile();
    const g = wear(p, 'aoi', 'charm', { rarity: 'legendary', level: 6 });
    const s = pieceSummary(g);
    expect(s.cells).toHaveLength(3);
    expect(s.cells[0]).toMatchObject({ key: 'main', stat: g.main.stat });
    expect(s.rest).toHaveLength(g.subs.length - 2);
    const plain = wear(p, 'rei', 'charm', { rarity: 'common', level: 2 });
    expect(pieceSummary(plain).cells).toHaveLength(1);
  });

  it('next growth every 3 levels, none at max', () => {
    const p = profile();
    const g = wear(p, 'aoi', 'shoes', { rarity: 'legendary', level: 7 });
    expect(nextGrowth(g)).toMatchObject({ at: 9, in: 2 });
    g.level = 10;
    expect(nextGrowth(g)).toBeNull();
  });

  it('▲ / ▼ against the piece she wears, per strip stat', () => {
    const p = profile();
    const cur = wear(p, 'aoi', 'charm', { rarity: 'rare', level: 0 });
    const cand = { ...cur, uid: 'c', main: { ...cur.main, value: cur.main.value + 0.1 } };
    const d = compareDeltas(cand, cur);
    expect(d[0]).toBe('▲ +10%');
    expect(compareDeltas(cur, cand)[0]).toBe('▼ −10%');
    expect(compareDeltas(cur, cur).every((x) => x === null)).toBe(true);
  });
});

describe('setView', () => {
  it('no club piece: nothing; 2 pieces: the 2-piece stat; 3: the trick too', () => {
    const p = profile();
    dress(p, 'aoi', { rarity: 'mythic', level: 2 });
    expect(setView(p, 'aoi')).toBeNull();
    const q = profile();
    wear(q, 'aoi', 'charm', { rarity: 'mythic', level: 2, club: 'taiko' });
    wear(q, 'aoi', 'ribbon', { rarity: 'mythic', level: 2, club: 'taiko' });
    let s = setView(q, 'aoi');
    expect([s.club.id, s.club.pieces, s.two.on, s.trick.on]).toEqual(['taiko', 2, true, false]);
    expect(s.two.short).toBe('RATE +5%');
    wear(q, 'aoi', 'shoes', { rarity: 'mythic', level: 2, club: 'taiko' });
    s = setView(q, 'aoi');
    expect([s.club.pieces, s.trick.on, s.trick.name]).toEqual([3, true, 'Big Beat']);
  });

  // M2 review look-1 (owner default Q3): the dead-trick rule, src/data/gearStats.js trickIdle
  const clubSet = (id, club, n = 3) => {
    const p = profile();
    for (const slot of ['charm', 'ribbon', 'shoes'].slice(0, n)) wear(p, id, slot, { rarity: 'mythic', level: 2, club });
    return setView(p, id);
  };

  it('a full set whose trick does nothing for her is never "on": First Bell on Kage (her ability comes later) and Miko (a rally)', () => {
    const kage = clubSet('kage', 'bell');
    expect([kage.club.pieces, kage.two.on, kage.trick.on, kage.trick.idle]).toEqual([3, true, false, 'later']);
    expect(kage.trick.idleText).toEqual({ long: 'First Bell: no effect on her yet (her ability comes in a later update)', short: 'First Bell: no effect yet' });
    const miko = clubSet('miko', 'bell');
    expect([miko.trick.on, miko.trick.idle]).toEqual([false, 'kind']);
    expect(miko.trick.idleText).toEqual({ long: 'First Bell: no effect on her (not team rallies or debuffs)', short: 'First Bell: no effect' });
    // the girls it charges: a strike, an econ, a map strike, a hero's burst and strike
    for (const id of ['aoi', 'momo', 'shiro', 'nami', 'seiran']) {
      const s = clubSet(id, 'bell');
      expect([s.trick.on, s.trick.idle, s.trick.idleText], id).toEqual([true, null, null]);
    }
    for (const [id, why] of [['suzu', 'later'], ['chika', 'later'], ['kanna', 'later'], ['hikari', 'kind'], ['luna', 'kind'], ['umeko', 'kind']]) {
      const s = clubSet(id, 'bell');
      expect([s.trick.on, s.trick.idle], id).toEqual([false, why]);
    }
    // 2 pieces: the trick is not reached, so there is nothing to say about it
    const two = clubSet('kage', 'bell', 2);
    expect([two.two.on, two.trick.on, two.trick.idle, two.trick.idleText]).toEqual([true, false, null, null]);
  });

  it('every other club\'s trick works on every kit: Taiko, Pyrotechnics, Tea on Kage and Miko are on', () => {
    for (const club of ['archery', 'fencing', 'taiko', 'pyro', 'tea']) {
      for (const id of ['kage', 'miko', 'hikari']) {
        const s = clubSet(id, club);
        expect([s.trick.on, s.trick.idle], `${club} ${id}`).toEqual([true, null]);
      }
    }
  });

  it('the Club Armband picker names the girl wearing the piece', () => {
    expect(idleTrickText('bell', 'later', 'Kage').long).toBe('First Bell: no effect on Kage yet (her ability comes in a later update)');
    expect(idleTrickText('bell', 'kind', 'Miko').long).toBe('First Bell: no effect on Miko (not team rallies or debuffs)');
    expect(idleTrickText('bell', null, 'Aoi')).toBeNull();
    expect(idleTrickText('nope', 'later')).toBeNull();
  });

  it('the set chip, the gear totals\' set line, the club strip and the picker all read it (source check: no DOM here)', () => {
    const src = (f) => readFileSync(new URL(`../../src/ui/${f}`, import.meta.url), 'utf8');
    const gg = src('girlGear.js');
    // the chip: grey and its short line instead of the trick's name; the set line: the grey "3" and the long line
    expect(gg).toMatch(/gk-set\$\{idle \? '\.idle'/);
    expect(gg).toMatch(/'data-testid': 'gear-set-idle' \}, idle\.short/);
    expect(gg).toMatch(/'data-testid': 'club-trick-idle'[^\n]*sticker\('3', 'off'\), ` \$\{set\.trick\.idleText\.long\}`/);
    const ur = src('gearUr.js');
    expect(ur).toMatch(/idleTrickText\(id, trickIdle\(id, wearer\.id\), wearer\.name\)/);
    expect(ur).toMatch(/idleTrickText\(id, trickIdle\(id, unitId\)\)/);
    // flat grey, never opacity (VAULT_BRIEF §2.4)
    const girlCss = src('styles/girl.css');
    expect(girlCss).toMatch(/\.gk-set\.idle \{[^}]*background: #d8dbda/);
    expect(girlCss.match(/\.gk-set\.idle[^{]*\{[^}]*\}/g).join('')).not.toMatch(/opacity/);
    expect(src('styles/components.css')).toMatch(/\.ui-sticker\.off \{ background: #d8dbda; \}/);
    expect(src('styles/gear-ur.css')).toMatch(/\.gu-band-note \{ font-size: 0\.75rem;/); // the 12 px floor
  });
});

// The tower panel's Club cell (src/ui/battle/buffs.js clubCellText; A3 M2 review look-1): "· trick on" only while her
// 3-piece trick does something for her now (src/data/gearStats.js trickIdle with t.abil, owner default Q3). First Bell
// says nothing on Kage (Shadow Doubles comes later), on Miko (a rally) or on Aoi before her ⚡ tier 3.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Sim } from '../../src/sim/Sim.js';
import { autoPlan } from '../../src/sim/headless.js';
import { abilityPathOf, waveStartCharge } from '../../src/sim/abilities.js';
import { xpToReach, gainHeroXp } from '../../src/sim/hero.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { clubCellText } from '../../src/ui/battle/buffs.js';

/** A real girl alone on 1-1 wearing `stats`, her ⚡ path bought to `tiers` (a hero at `level`). */
function girl(id, stats, { tiers = 3, level = 7 } = {}) {
  const u = UNIT_MAP[id];
  const hero = u.kind === 'hero';
  const sim = new Sim({ stageId: '1-1', loadout: hero ? [] : [{ unitId: id, stats }], hero: hero ? { unitId: id, stats } : null, seed: 1 });
  sim.cash = 1e9;
  const spot = autoPlan('1-1', [id]).find((a) => a.action === 'place');
  const t = sim.placeTower(id, spot.x, spot.y);
  if (hero) { if (level > 1) gainHeroXp(sim, t, xpToReach(u.hero, level), 'restore'); }
  else for (let i = 0; i < tiers; i++) expect(sim.upgradeTower(t.uid, abilityPathOf(u)), `${id} tier ${i + 1}`).toBe(true);
  return t;
}
const bell = (n = 3) => ({ club: 'bell', clubN: n });

describe('the Club cell', () => {
  it('First Bell: "trick on" exactly while it charges her ability at a wave start', () => {
    const rows = [
      ['kage', {}, 'Bell ●●●'], // Shadow Doubles has no button yet
      ['miko', {}, 'Bell ●●●'], // her Chorus is a rally
      ['hikari', {}, 'Bell ●●●'], // her skill is a rally
      ['aoi', { tiers: 2 }, 'Bell ●●●'], // below ⚡ tier 3: no ability yet
      ['nami', { level: 6 }, 'Bell ●●●'], // below Lv 7
      ['aoi', {}, 'Bell ●●● · trick on'],
      ['shiro', {}, 'Bell ●●● · trick on'],
      ['nami', {}, 'Bell ●●● · trick on'],
    ];
    for (const [id, o, want] of rows) {
      const t = girl(id, bell(), o);
      expect(clubCellText(t), `${id} ${JSON.stringify(o)}`).toBe(want);
      // the cell says what the sim does
      expect(waveStartCharge(null, t) > 0, `${id} charge`).toBe(want.endsWith('trick on'));
    }
  });

  it('every other club: "trick on" at 3 pieces on any girl, Kage and Miko too; 2 pieces show the pips only; no club, no cell', () => {
    expect(clubCellText(girl('kage', { club: 'taiko', clubN: 3 }))).toBe('Taiko ●●● · trick on');
    expect(clubCellText(girl('miko', { club: 'pyro', clubN: 3 }))).toBe('Pyrotechnics ●●● · trick on');
    expect(clubCellText(girl('kage', { club: 'tea', clubN: 3 }))).toBe('Tea ●●● · trick on');
    expect(clubCellText(girl('aoi', bell(2)))).toBe('Bell ●●');
    expect(clubCellText(girl('aoi', { club: 'fencing', clubN: 1 }))).toBe('');
    expect(clubCellText(girl('aoi', {}))).toBe('');
    expect(clubCellText(null)).toBe('');
  });

  it('the panel draws the cell from the helper (source check)', () => {
    const src = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');
    expect(src).toMatch(/const club = clubCellText\(t\);\s*if \(club\) add\('Club', club, '\.bt-stat-wide2'\);/);
    expect(src).not.toMatch(/trick on/);
    expect(src).not.toMatch(/CLUB_NAMES/);
  });
});

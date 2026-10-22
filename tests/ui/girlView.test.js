// The girl page's Glance facts (src/ui/girlView.js, docs/specs/UI_DIRECTION.md §5.2 / §6.2): her role's three
// headline stats (owner, Oct 20: shooters DMG · RATE · RANGE, supports BUFF · RANGE · AFFECTS, income COINS/WAVE ·
// RANGE · COST, heroes DMG · RATE · ULT), the trait chips, the matchup row and the hero track band.
import { describe, it, expect } from 'vitest';
import { headlineStats, headlineKind, roleSentence, roleDetails, profileTips, isAbilityTip, traitList, matchupList, matchArrows, heroBandView } from '../../src/ui/girlView.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { ROLES } from '../../src/data/types.js';
import { ROLE_SUBCLASS } from '../../src/data/wiki.js';
import { newUnitState } from '../../src/systems/save.js';
import { abilityRuns } from '../../src/data/abilities.js';

const profileWith = (over = {}) => {
  const p = { units: {}, gear: {} };
  for (const u of UNITS) p.units[u.id] = Object.assign(newUnitState(), { level: 30, breakthrough: 2 }, over[u.id] || {});
  return p;
};
const labels = (id, p = profileWith()) => headlineStats(UNIT_MAP[id], p).map((c) => c.label).join(' · ');

describe('headlineStats', () => {
  it('exactly 3 stats for every girl, each with a value and a full-fact title', () => {
    const p = profileWith();
    for (const u of UNITS) {
      const cells = headlineStats(u, p);
      expect(cells, u.id).toHaveLength(3);
      for (const c of cells) {
        expect(c.value, `${u.id} ${c.label}`).toBeTruthy();
        expect(c.title.length).toBeGreaterThan(3);
        expect(c.value).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it('chosen by role', () => {
    expect(labels('aoi')).toBe('DMG · RATE · RANGE');
    expect(labels('hikari')).toBe('DMG · RATE · ULT');
    expect(labels('momo')).toBe('COINS/WAVE · RANGE · COST');
    expect(labels('miko')).toBe('BUFF · RANGE · AFFECTS');
    expect(labels('ouka')).toBe('BUFF · RANGE · AFFECTS');
    expect(labels('wakaba')).toBe('BUFF · RANGE · AFFECTS');
    expect(headlineKind(UNIT_MAP.chika)).toBe('shooter'); // her sentries fight: no aura to headline
  });

  it('the numbers are hers at tier 0: level, gear and Potential move them', () => {
    const low = headlineStats(UNIT_MAP.aoi, profileWith({ aoi: { level: 1, breakthrough: 0 } }))[0];
    const high = headlineStats(UNIT_MAP.aoi, profileWith({ aoi: { level: 60, breakthrough: 5 } }))[0];
    expect(Number(high.value)).toBeGreaterThan(Number(low.value));
  });

  it('formats: one decimal at most, rate with its unit, buffs signed, money for a cost', () => {
    const p = profileWith();
    const [dmg, rate, range] = headlineStats(UNIT_MAP.aoi, p);
    expect(dmg.value).toMatch(/^\d+(\.\d)?$/);
    expect(rate.unit).toBe('/s');
    expect(range.value).toMatch(/^\d+(\.\d)?$/);
    const [buff, , affects] = headlineStats(UNIT_MAP.miko, p);
    expect(buff.value).toBe('+10%');
    expect(affects.value).toBe('Allies');
    expect(headlineStats(UNIT_MAP.ouka, p)[0].value).toBe('−5%');
    const [coins, , cost] = headlineStats(UNIT_MAP.momo, p);
    expect(coins.value).toBe('+30');
    expect(cost.value).toMatch(/^\d{1,3}(,\d{3})*$/);
    expect(headlineStats(UNIT_MAP.hikari, p)[2].value).toBe('LV 3');
  });
});

describe('roleSentence', () => {
  it('one sentence, the shorter of the two role lines', () => {
    for (const u of UNITS) {
      const s = roleSentence(u);
      expect(s.length, u.id).toBeGreaterThan(5);
      expect(s.length).toBeLessThanOrEqual(100);
    }
  });
});

describe('roleDetails (Base stats › Role)', () => {
  it('her subclass label and both role lines, the Glance one first: nothing of the old Info tab is lost', () => {
    for (const u of UNITS) {
      const r = roleDetails(u);
      expect(r.label, u.id).toBe(ROLE_SUBCLASS[u.role]?.label || ROLES[u.role]?.name);
      expect(r.lines[0], u.id).toBe(roleSentence(u));
      for (const line of [ROLE_SUBCLASS[u.role]?.desc, ROLES[u.role]?.desc].filter(Boolean)) expect(r.lines, u.id).toContain(line);
      expect(new Set(r.lines).size).toBe(r.lines.length);
    }
    expect(roleDetails(UNIT_MAP.aoi).lines).toContain('Cheap, reliable shots; good vs crystal shells.');
  });
});

describe('profileTips (a ⚡ tip only when her ability runs)', () => {
  it('a working ability\'s ⚡ tip shows; Kage, Suzu and Chika promise no button; the other tips stay, in order', () => {
    for (const u of UNITS) {
      const t = profileTips(u);
      const runs = abilityRuns(u.paths?.find((p) => p.ability)?.ability || u.hero?.skill || null);
      expect(t, u.id).toEqual(runs ? u.tips || [] : (u.tips || []).filter((x) => !isAbilityTip(x)));
    }
    for (const id of ['aoi', 'momo', 'umeko', 'miko', 'akane', 'ouka']) {
      expect(UNIT_MAP[id].tips.some(isAbilityTip), id).toBe(true);
      expect(profileTips(UNIT_MAP[id]).some((x) => x.startsWith('⚡')), id).toBe(true);
    }
    for (const id of ['kage', 'suzu', 'chika']) {
      expect(UNIT_MAP[id].tips.some(isAbilityTip), id).toBe(true);
      expect(profileTips(UNIT_MAP[id]).some((x) => x.includes('⚡') || /\bteaches\b/.test(x)), id).toBe(false);
    }
  });
});

describe('traitList', () => {
  it('attack type first, tier-0 traits before the ones her upgrades add', () => {
    for (const u of UNITS) {
      const t = traitList(u);
      expect(t[0].kind, u.id).toBe('attack');
      const firstLater = t.findIndex((x) => x.later);
      if (firstLater >= 0) expect(t.slice(firstLater).every((x) => x.later), u.id).toBe(true);
      expect(new Set(t.map((x) => x.id)).size).toBe(t.length);
    }
  });
});

describe('matchupList', () => {
  it('only the armors that differ, strongest first, arrows carry the meaning', () => {
    const m = matchupList('pierce');
    expect(m.map((x) => x.armor)).toEqual(['scaled', 'light', 'heavy', 'spectral']);
    expect(m.map((x) => x.arrows)).toEqual(['▲▲', '▲', '▼', '▼▼']);
    expect(matchArrows(1)).toBe('');
  });
});

describe('heroBandView', () => {
  const levels = UNIT_MAP.hikari.hero.levels;
  it('her current level ±2, clamped to the track; the rest behind Full track', () => {
    expect(heroBandView(levels, { current: 1 }).rows.map((l) => l.level)).toEqual([1, 2, 3]);
    expect(heroBandView(levels, { current: 10 }).rows.map((l) => l.level)).toEqual([8, 9, 10, 11, 12]);
    const end = heroBandView(levels, { current: 25 });
    expect(end.rows.map((l) => l.level)).toEqual([23, 24, 25]);
    expect(end.more).toBe(true);
    expect(heroBandView(levels, { current: 99 }).current).toBe(levels.length);
  });
});

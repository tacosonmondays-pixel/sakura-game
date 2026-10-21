// Catch-up joins (src/systems/catchUpJoins.js): Noa (6-2) and Hana (7-5) join once, with a letter, for a
// save that cleared their stage before they existed, through the same grant as a stage win. The marks
// ('join:<id>') live in missions.counters, which every build keeps word for word, so reloads and older
// tabs never bring a second grant. The older builds: v0.1.39 (the live build this branches from) loads
// and saves with this very save.js / store.js (this change leaves both untouched) and never runs the
// catch-up at its start; v0.1.38 does not know the returning girls and drops them, keeping counters
// (`v0138Save`, as in rosterSave.test.js).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UNITS } from '../../src/data/units.js';
import { CAMPAIGN_IDS } from '../../src/data/stages.js';
import { EXPANSION_IDS } from '../../src/data/unitsExpansion.js';
import { ACHIEVEMENT_MAP } from '../../src/data/achievements.js';
import { createProfile, migrateProfile, SAVE_KEY } from '../../src/systems/save.js';
import { createStore, saveText } from '../../src/core/store.js';
import { grantUnit, isOwned } from '../../src/systems/unlocks.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { metricValue } from '../../src/systems/achievementMetrics.js';
import { createRng } from '../../src/core/rng.js';
import {
  ensureCatchUpJoins, joinStageOf, joinLetter, joinLetterId, JOIN_PREFIX, CATCH_UP_UNITS,
} from '../../src/systems/catchUpJoins.js';

const NOW = Date.parse('2026-10-22T18:00:00Z');
const clone = (x) => JSON.parse(JSON.stringify(x));
const OLD_IDS = new Set(UNITS.map((u) => u.id).filter((id) => !EXPANSION_IDS.includes(id)));
const medal = (d = 'normal') => ({ easy: false, normal: false, hard: false, nightmare: false, [d]: true, clears: 1 });
const letters = (p, id) => p.mail.letters.filter((l) => l.id === joinLetterId(id));
const sans = ({ obtainedAt, ...u }) => u;
/** A v0.1.39 tab's load and save (its migrateProfile and saveText are this build's; no catch-up at its start). */
const v0139Load = (p) => migrateProfile(JSON.parse(saveText(p, 1)));
/** A v0.1.38 tab's load and save: the returning girls are left out, her bond entry goes, counters stay. */
function v0138Save(p) {
  const raw = clone(p);
  for (const id of Object.keys(raw.units)) {
    if (OLD_IDS.has(id)) continue;
    delete raw.units[id];
    delete raw.bond[id];
  }
  raw.formation.towers = raw.formation.towers.filter((id) => raw.units[id]);
  return raw;
}

/** A save that cleared the campaign up to `last` (every campaign stage up to it, Normal). */
function clearedUpTo(last) {
  const p = createProfile();
  const upTo = CAMPAIGN_IDS.indexOf(last);
  expect(upTo).toBeGreaterThanOrEqual(0);
  for (const id of CAMPAIGN_IDS.slice(0, upTo + 1)) p.progress.stages[id] = medal();
  return migrateProfile(clone(p));
}

describe('catch-up joins: data', () => {
  it('Noa joins on 6-2 and Hana on 7-5, the stages whose win grants them', () => {
    expect(CATCH_UP_UNITS).toEqual(['noa', 'hana']);
    expect(joinStageOf('noa').id).toBe('6-2');
    expect(joinStageOf('hana').id).toBe('7-5');
    expect(joinLetter('noa').title).toBe('Noa joined your academy!');
    expect(joinLetter('hana').title).toBe('Hana joined your academy!');
    expect(joinLetter('noa').rewards).toEqual([]);
    expect(joinLetter('nobody')).toBe(null);
  });
});

describe('catch-up joins', () => {
  it('a fresh save gets nobody, no mark and no letter, however often it loads', () => {
    let p = createProfile();
    for (let i = 0; i < 3; i++) {
      expect(ensureCatchUpJoins(p, NOW)).toEqual([]);
      p = migrateProfile(JSON.parse(saveText(p, i + 1)));
    }
    expect(isOwned(p, 'noa') || isOwned(p, 'hana')).toBe(false);
    expect(p.missions.counters[JOIN_PREFIX + 'noa']).toBeUndefined();
    expect(p.missions.counters[JOIN_PREFIX + 'hana']).toBeUndefined();
    expect(p.mail.letters.some((l) => l.id.startsWith('joined-'))).toBe(false);
  });

  it('a save that cleared 6-2 and 7-5 gets both girls once, each with her letter and her marks', () => {
    const p = clearedUpTo('7-5');
    p.progress.stages['7-5'] = medal('hard'); // any medal counts
    const owned = metricValue(p, ACHIEVEMENT_MAP.a_units_10);
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['noa', 'hana']);
    for (const id of ['noa', 'hana']) {
      expect(p.units[id].level).toBe(1);
      expect(p.units[id].dupes || 0).toBe(0);
      expect(p.missions.counters[JOIN_PREFIX + id]).toBe(1);
      expect(p.missions.counters['own:' + id]).toBe(1000); // her 'own:' mark (an older build that drops her gives her back)
      expect(p.missions.counters['pot:' + id]).toBe(0); // her Potential shadow
      expect(p.bond[id]).toBe(0);
      expect(letters(p, id)).toHaveLength(1);
      expect(letters(p, id)[0].claimed).toBe(false);
    }
    expect(metricValue(p, ACHIEVEMENT_MAP.a_units_10)).toBe(owned + 2); // the roster achievements count her
    expect(ensureCatchUpJoins(p, NOW + 1000)).toEqual([]);
    expect(letters(p, 'noa')).toHaveLength(1);
  });

  it('she is exactly the girl a stage win grants (same unit, same marks)', () => {
    const won = clearedUpTo('6-1');
    const out = applyBattleResult(won, { stageId: '6-2', difficulty: 'normal', won: true, wave: 27, livesLeft: 10, encountered: [], kills: {} }, createRng(1), { now: new Date(NOW) });
    expect(out.unlockedUnits).toEqual(['noa']);
    const caught = clearedUpTo('6-2');
    expect(ensureCatchUpJoins(caught, NOW)).toEqual(['noa']);
    expect(sans(caught.units.noa)).toEqual(sans(won.units.noa));
    for (const k of ['own:noa', 'pot:noa']) expect(caught.missions.counters[k]).toBe(won.missions.counters[k]);
    // after that win the next load only marks her as settled: no letter, nothing granted
    expect(ensureCatchUpJoins(won, NOW)).toEqual([]);
    expect(won.missions.counters[JOIN_PREFIX + 'noa']).toBe(1);
    expect(letters(won, 'noa')).toHaveLength(0);
  });

  it('only the cleared stage counts: Hana waits for her 7-5 win, which grants her as usual', () => {
    const p = clearedUpTo('7-4');
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['noa']);
    expect(isOwned(p, 'hana')).toBe(false);
    expect(p.missions.counters[JOIN_PREFIX + 'hana']).toBeUndefined();
    const out = applyBattleResult(p, { stageId: '7-5', difficulty: 'normal', won: true, wave: 30, livesLeft: 10, encountered: [], kills: {} }, createRng(2), { now: new Date(NOW) });
    expect(out.unlockedUnits).toEqual(['hana']);
    expect(ensureCatchUpJoins(p, NOW)).toEqual([]);
    expect(p.missions.counters[JOIN_PREFIX + 'hana']).toBe(1);
    expect(letters(p, 'hana')).toHaveLength(0);
  });

  it('a girl already owned is never granted (no duplicate, no Essence, no letter)', () => {
    const p = clearedUpTo('7-5');
    grantUnit(p, 'noa', NOW);
    p.units.noa.level = 30;
    p.units.noa.dupes = 2;
    const before = clone(p.units.noa);
    const items = clone(p.items);
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['hana']);
    expect(p.units.noa).toEqual(before);
    expect(p.items).toEqual(items);
    expect(p.missions.counters[JOIN_PREFIX + 'noa']).toBe(1);
    expect(letters(p, 'noa')).toHaveLength(0);
  });

  it('repeated loads give one grant and one letter per girl', () => {
    let p = clearedUpTo('7-5');
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['noa', 'hana']);
    const first = clone(p.units);
    for (let i = 0; i < 4; i++) {
      p = migrateProfile(JSON.parse(saveText(p, i + 2)));
      expect(ensureCatchUpJoins(p, NOW + i)).toEqual([]);
    }
    expect(Object.fromEntries(Object.entries(p.units).map(([k, u]) => [k, sans(u)]))).toEqual(Object.fromEntries(Object.entries(first).map(([k, u]) => [k, sans(u)])));
    for (const id of ['noa', 'hana']) {
      expect(letters(p, id)).toHaveLength(1);
      expect(p.mail.delivered.filter((x) => x === joinLetterId(id))).toHaveLength(1);
    }
  });

  it('a settled mark is final: a girl lost without her own mark is never granted a second time', () => {
    const p = clearedUpTo('6-2');
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['noa']);
    delete p.units.noa;
    delete p.missions.counters['own:noa'];
    const q = migrateProfile(clone(p));
    expect(isOwned(q, 'noa')).toBe(false);
    expect(ensureCatchUpJoins(q, NOW)).toEqual([]);
    expect(isOwned(q, 'noa')).toBe(false);
  });
});

describe('catch-up joins and older tabs', () => {
  it('a v0.1.39 tab that loads and saves keeps her and her mark; back here nothing happens twice', () => {
    const p = clearedUpTo('7-5');
    ensureCatchUpJoins(p, NOW);
    const old = v0139Load(p); // that build's app start never runs the catch-up
    expect(isOwned(old, 'noa') && isOwned(old, 'hana')).toBe(true);
    expect(old.missions.counters[JOIN_PREFIX + 'noa']).toBe(1);
    old.progress.stages['6-2'].clears += 1; // and a 6-2 win there grants nobody (she is owned)
    const back = migrateProfile(JSON.parse(saveText(old, 3)));
    expect(ensureCatchUpJoins(back, NOW)).toEqual([]);
    expect(back.units.noa.dupes || 0).toBe(0);
    expect(letters(back, 'noa')).toHaveLength(1);
    expect(letters(back, 'hana')).toHaveLength(1);
  });

  it('a v0.1.38 tab drops both girls; their own marks bring them back and the join marks stop a second grant', () => {
    const p = clearedUpTo('7-5');
    ensureCatchUpJoins(p, NOW);
    p.units.noa.level = 8; // (gate 0 caps her at 10)
    grantUnit(p, 'hana', NOW); // a duplicate later on (a select ticket): 1 Essence
    const raw = v0138Save(JSON.parse(saveText(p, 2)));
    expect(raw.units.noa).toBeUndefined();
    expect(raw.missions.counters[JOIN_PREFIX + 'noa']).toBe(1);
    const back = migrateProfile(raw);
    expect(back.units.noa.level).toBe(8);
    expect(back.units.hana.dupes).toBe(1);
    expect(ensureCatchUpJoins(back, NOW)).toEqual([]);
    expect(back.units.hana.dupes).toBe(1);
    expect(letters(back, 'noa')).toHaveLength(1);
  });

  it('a v0.1.38 save that cleared 6-2 loads in v0.1.39 without Noa and gets her here, once', () => {
    const p = clearedUpTo('6-3');
    const raw = v0138Save(JSON.parse(saveText(p, 1)));
    const old = v0139Load(migrateProfile(raw));
    expect(isOwned(old, 'noa')).toBe(false); // v0.1.39 grants her only on a new 6-2 win
    const here = migrateProfile(JSON.parse(saveText(old, 2)));
    expect(ensureCatchUpJoins(here, NOW)).toEqual(['noa']);
    // the next v0.1.38 round trip loses nothing and grants nothing again
    const again = migrateProfile(v0138Save(JSON.parse(saveText(here, 3))));
    expect(isOwned(again, 'noa')).toBe(true);
    expect(ensureCatchUpJoins(again, NOW)).toEqual([]);
    expect(letters(again, 'noa')).toHaveLength(1);
  });
});

describe('catch-up joins with two tabs on one storage', () => {
  let ls;
  beforeEach(() => {
    const m = new Map();
    ls = { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
    vi.stubGlobal('localStorage', ls);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('a stale tab opened before the update never writes her away, and a reload grants nothing twice', () => {
    ls.setItem(SAVE_KEY, JSON.stringify(clearedUpTo('7-5')));
    const oldTab = createStore({ debounceMs: 0 });
    oldTab.load(); // still on v0.1.39: no catch-up at its start
    const newTab = createStore({ debounceMs: 0 });
    newTab.load();
    expect(ensureCatchUpJoins(newTab.profile, NOW)).toEqual(['noa', 'hana']);
    newTab.commit('mail');
    newTab.saveNow();
    // the old tab plays on (a 6-2 re-clear in memory) and tries to save: it is stale and writes nothing
    oldTab.profile.progress.stages['6-2'].clears += 1;
    oldTab.commit('battle-result');
    oldTab.saveNow();
    expect(oldTab.stale).toBe(true);
    for (let i = 0; i < 2; i++) {
      const tab = createStore({ debounceMs: 0 });
      tab.load();
      expect(isOwned(tab.profile, 'noa') && isOwned(tab.profile, 'hana')).toBe(true);
      expect(ensureCatchUpJoins(tab.profile, NOW)).toEqual([]);
      expect(letters(tab.profile, 'noa')).toHaveLength(1);
      tab.saveNow();
    }
  });
});

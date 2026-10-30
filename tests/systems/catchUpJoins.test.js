// Catch-up joins (src/systems/catchUpJoins.js): the free girls who join on a stage win join once, with a
// letter, for a save that cleared her stage before she existed, through the same grant as a stage win:
// Noa (6-2) and Hana (7-5) since v0.1.39, Azami (2-2), Yuzuha (4-2) and Wakaba (6-5) since v0.1.40. Gate Arc moves
// Yuzuha's join to 1-7 (chapter 1's Act II); a 4-2 clear still settles her once (LEGACY_JOIN_STAGES). Step 4 moves
// Azami's to 4-7; a 2-2 clear made before this build still brings her once (PRE_UPDATE_JOIN_STAGES), a later one never.
// The marks ('join:<id>') live in missions.counters, which every build keeps word for word, so reloads
// and older tabs never bring a second grant. The older builds, played the way their migrateProfile
// treats a save (as in rosterSave.test.js): v0.1.39 knows Noa and Hana but not the seven new academy
// girls and drops those (`v0139Save`); v0.1.38 knows neither and drops both groups (`v0138Save`). Both
// keep counters word for word and never run the catch-up at their start.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { CAMPAIGN_IDS, STAGE_MAP, stageOrderKey } from '../../src/data/stages.js';
import { EXPANSION_IDS } from '../../src/data/unitsExpansion.js';
import { NEW_GIRL_IDS } from '../../src/data/unitsNewGirls.js';
import { ACHIEVEMENT_MAP } from '../../src/data/achievements.js';
import { createProfile, migrateProfile, SAVE_KEY } from '../../src/systems/save.js';
import { createStore, saveText } from '../../src/core/store.js';
import { grantUnit, isOwned } from '../../src/systems/unlocks.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { metricValue } from '../../src/systems/achievementMetrics.js';
import { OWN_PREFIX } from '../../src/systems/rosterSave.js';
import { createRng } from '../../src/core/rng.js';
import {
  ensureCatchUpJoins, joinStageOf, joinLetter, joinLetterId, joinToastText, JOIN_PREFIX, CATCH_UP_UNITS, LEGACY_JOIN_STAGES,
  PRE_UPDATE_JOIN_STAGES, JOIN_WINDOW_PREFIX,
} from '../../src/systems/catchUpJoins.js';

const NOW = Date.parse('2026-10-22T18:00:00Z');
const clone = (x) => JSON.parse(JSON.stringify(x));
/** The girls v0.1.39 knows: every girl but the seven new academy girls. */
const V0139_IDS = new Set(UNITS.map((u) => u.id).filter((id) => !NEW_GIRL_IDS.includes(id)));
/** The girls v0.1.38 knows: the roster before the returning girls (and before the seven). */
const V0138_IDS = new Set([...V0139_IDS].filter((id) => !EXPANSION_IDS.includes(id)));
/**
 * The v0.1.40 catch-up girls: her catch-up stage, and the stage whose win grants her now (Yuzuha: 4-2 legacy, 1-7;
 * Azami: a pre-update 2-2 clear, 4-7). The fixtures are saves from before this build (no catch-up run yet).
 */
const NEW_JOINS = [['azami', '2-2', '4-7'], ['yuzuha', '4-2', '1-7'], ['wakaba', '6-5', '6-5']];
const ALL_JOINS = ['yuzuha', 'azami', 'noa', 'wakaba', 'hana'];
const medal = (d = 'normal') => ({ easy: false, normal: false, hard: false, nightmare: false, [d]: true, clears: 1 });
const letters = (p, id) => p.mail.letters.filter((l) => l.id === joinLetterId(id));
const joinLetters = (p) => p.mail.letters.filter((l) => /^joined-/.test(l.id));
const sans = ({ obtainedAt, ...u }) => u;
const prevStage = (id) => CAMPAIGN_IDS[CAMPAIGN_IDS.indexOf(id) - 1];
const win = (p, stageId, seed = 1) => applyBattleResult(p, { stageId, difficulty: 'normal', won: true, wave: STAGE_MAP[stageId].waves, livesLeft: 10, encountered: [], kills: {} }, createRng(seed), { now: new Date(NOW) });

/** An older tab's load and save: only the girls it knows stay, their bond entries go, counters stay. */
function olderTabSave(p, known) {
  const raw = clone(p);
  for (const id of Object.keys(raw.units)) {
    if (known.has(id)) continue;
    delete raw.units[id];
    delete raw.bond[id];
  }
  raw.formation.towers = raw.formation.towers.filter((id) => raw.units[id]);
  return raw;
}
/** A v0.1.39 tab's load and save: the seven new academy girls are left out. */
const v0139Save = (p) => olderTabSave(p, V0139_IDS);
/** A v0.1.38 tab's load and save: the returning girls and the seven are left out. */
const v0138Save = (p) => olderTabSave(p, V0138_IDS);
/** A v0.1.39 tab that loads and saves (no catch-up at its start), then this build's load. */
const viaV0139 = (p, n = 1) => migrateProfile(v0139Save(JSON.parse(saveText(p, n))));

/** A save that cleared the campaign up to `last` (every campaign stage up to it, Normal). */
function clearedUpTo(last) {
  const p = createProfile();
  const upTo = CAMPAIGN_IDS.indexOf(last);
  expect(upTo).toBeGreaterThanOrEqual(0);
  for (const id of CAMPAIGN_IDS.slice(0, upTo + 1)) p.progress.stages[id] = medal();
  return migrateProfile(clone(p));
}

describe('catch-up joins: data', () => {
  it('Yuzuha 1-7, Azami 4-7, Noa 6-2, Wakaba 6-5 and Hana 7-5, the stages whose win grants them, in play order', () => {
    expect(CATCH_UP_UNITS).toEqual(ALL_JOINS);
    expect(LEGACY_JOIN_STAGES).toEqual({ yuzuha: ['4-2'] });
    expect(PRE_UPDATE_JOIN_STAGES).toEqual({ azami: ['2-2'] });
    expect(STAGE_MAP['4-2'].unlocks.units).toBeUndefined();
    expect(STAGE_MAP['2-2'].unlocks.units).toBeUndefined();
    const stages = { yuzuha: '1-7', azami: '4-7', noa: '6-2', wakaba: '6-5', hana: '7-5' };
    for (const [id, stage] of Object.entries(stages)) {
      expect(joinStageOf(id).id, id).toBe(stage);
      expect(UNIT_MAP[id].acquisition).toMatchObject({ type: 'free', afterStage: stage });
      expect(joinLetter(id).title).toBe(`${UNIT_MAP[id].name} joined your academy!`);
      expect(joinLetter(id).rewards).toEqual([]);
    }
    const order = CATCH_UP_UNITS.map((id) => stageOrderKey(joinStageOf(id).id));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(joinLetter('nobody')).toBe(null);
  });

  it('every free girl added since v0.1.39 (returning girls, the seven) is on the list; the other four of the seven are Recruit only', () => {
    const late = UNITS.filter((u) => (EXPANSION_IDS.includes(u.id) || NEW_GIRL_IDS.includes(u.id)) && u.acquisition.type === 'free').map((u) => u.id);
    expect([...late].sort()).toEqual([...CATCH_UP_UNITS].sort());
    for (const id of ['kinu', 'ouka', 'chigusa', 'marumi']) {
      expect(UNIT_MAP[id].acquisition.type, id).toBe('gacha');
      expect(joinStageOf(id), id).toBe(null);
    }
  });

  it('the lobby toast names everyone who joined in one line', () => {
    expect(joinToastText([])).toBe('');
    expect(joinToastText(['azami'])).toBe('Azami joined your academy! Details in your Mailbox.');
    expect(joinToastText(['noa', 'hana'])).toBe('Noa and Hana joined your academy! Details in your Mailbox.');
    expect(joinToastText(['azami', 'yuzuha', 'wakaba'])).toBe('Azami, Yuzuha and Wakaba joined your academy! Details in your Mailbox.');
    expect(joinToastText(ALL_JOINS)).toBe('Yuzuha, Azami, Noa, Wakaba and Hana joined your academy! Details in your Mailbox.');
  });
});

describe('catch-up joins', () => {
  it('a fresh save gets nobody, no mark and no letter, however often it loads', () => {
    let p = createProfile();
    for (let i = 0; i < 3; i++) {
      expect(ensureCatchUpJoins(p, NOW)).toEqual([]);
      p = migrateProfile(JSON.parse(saveText(p, i + 1)));
    }
    for (const id of ALL_JOINS) {
      expect(isOwned(p, id), id).toBe(false);
      expect(p.missions.counters[JOIN_PREFIX + id], id).toBeUndefined();
    }
    expect(joinLetters(p)).toHaveLength(0);
  });

  it('a save that cleared up to 7-5 gets all five girls once, each with her letter and her marks', () => {
    const p = clearedUpTo('7-5');
    p.progress.stages['7-5'] = medal('hard'); // any medal counts
    const owned = metricValue(p, ACHIEVEMENT_MAP.a_units_10);
    expect(ensureCatchUpJoins(p, NOW)).toEqual(ALL_JOINS);
    for (const id of ALL_JOINS) {
      expect(p.units[id].level).toBe(1);
      expect(p.units[id].dupes || 0).toBe(0);
      expect(p.missions.counters[JOIN_PREFIX + id]).toBe(1);
      expect(p.missions.counters[OWN_PREFIX + id]).toBe(1000); // her 'own:' mark (an older build that drops her gives her back)
      expect(p.missions.counters['pot:' + id]).toBe(0); // her Potential shadow
      expect(p.bond[id]).toBe(0);
      expect(letters(p, id)).toHaveLength(1);
      expect(letters(p, id)[0].claimed).toBe(false);
    }
    // the Mailbox (newest first) reads top to bottom in play order
    expect(joinLetters(p).map((l) => l.title)).toEqual(ALL_JOINS.map((id) => `${UNIT_MAP[id].name} joined your academy!`));
    expect(metricValue(p, ACHIEVEMENT_MAP.a_units_10)).toBe(owned + 5); // the roster achievements count them
    expect(ensureCatchUpJoins(p, NOW + 1000)).toEqual([]);
    expect(joinLetters(p)).toHaveLength(5);
  });

  it('she is exactly the girl a stage win grants (same unit, same marks)', () => {
    const won = clearedUpTo('6-1');
    expect(ensureCatchUpJoins(won, NOW)).toEqual(['yuzuha', 'azami']);
    expect(win(won, '6-2').unlockedUnits).toEqual(['noa']);
    const caught = clearedUpTo('6-2');
    expect(ensureCatchUpJoins(caught, NOW)).toEqual(['yuzuha', 'azami', 'noa']);
    expect(sans(caught.units.noa)).toEqual(sans(won.units.noa));
    for (const k of ['own:noa', 'pot:noa']) expect(caught.missions.counters[k]).toBe(won.missions.counters[k]);
    // after that win the next load only marks her as settled: no letter, nothing granted
    expect(ensureCatchUpJoins(won, NOW)).toEqual([]);
    expect(won.missions.counters[JOIN_PREFIX + 'noa']).toBe(1);
    expect(letters(won, 'noa')).toHaveLength(0);
  });

  it('only the cleared stage counts: Hana waits for her 7-5 win, which grants her as usual', () => {
    const p = clearedUpTo('7-4');
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['yuzuha', 'azami', 'noa', 'wakaba']);
    expect(isOwned(p, 'hana')).toBe(false);
    expect(p.missions.counters[JOIN_PREFIX + 'hana']).toBeUndefined();
    expect(win(p, '7-5', 2).unlockedUnits).toEqual(['hana']);
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
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['yuzuha', 'azami', 'wakaba', 'hana']);
    expect(p.units.noa).toEqual(before);
    expect(p.items).toEqual(items);
    expect(p.missions.counters[JOIN_PREFIX + 'noa']).toBe(1);
    expect(letters(p, 'noa')).toHaveLength(0);
  });

  it('repeated loads give one grant and one letter per girl', () => {
    let p = clearedUpTo('7-5');
    expect(ensureCatchUpJoins(p, NOW)).toEqual(ALL_JOINS);
    const first = clone(p.units);
    for (let i = 0; i < 4; i++) {
      p = migrateProfile(JSON.parse(saveText(p, i + 2)));
      expect(ensureCatchUpJoins(p, NOW + i)).toEqual([]);
    }
    expect(Object.fromEntries(Object.entries(p.units).map(([k, u]) => [k, sans(u)]))).toEqual(Object.fromEntries(Object.entries(first).map(([k, u]) => [k, sans(u)])));
    for (const id of ALL_JOINS) {
      expect(letters(p, id)).toHaveLength(1);
      expect(p.mail.delivered.filter((x) => x === joinLetterId(id))).toHaveLength(1);
    }
  });

  it('a settled mark is final: a girl lost without her own mark is never granted a second time', () => {
    const p = clearedUpTo('6-2');
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['yuzuha', 'azami', 'noa']);
    delete p.units.noa;
    delete p.missions.counters['own:noa'];
    const q = migrateProfile(clone(p));
    expect(isOwned(q, 'noa')).toBe(false);
    expect(ensureCatchUpJoins(q, NOW)).toEqual([]);
    expect(isOwned(q, 'noa')).toBe(false);
  });
});

describe.each(NEW_JOINS)('catch-up joins: %s (%s)', (id, stage, winStage) => {
  const name = UNIT_MAP[id].name;

  it(`a save that cleared ${stage} gets ${name} once, with one letter and her marks`, () => {
    const p = clearedUpTo(stage);
    const joined = ensureCatchUpJoins(p, NOW);
    expect(joined).toContain(id);
    expect(joined.filter((x) => x === id)).toHaveLength(1);
    expect(p.units[id].level).toBe(1);
    expect(p.units[id].dupes || 0).toBe(0);
    expect(p.missions.counters[JOIN_PREFIX + id]).toBe(1);
    expect(p.missions.counters[OWN_PREFIX + id]).toBe(1000);
    expect(letters(p, id)).toHaveLength(1);
    expect(letters(p, id)[0].title).toBe(`${name} joined your academy!`);
    expect(letters(p, id)[0].body).toContain(`stage ${stage}`);
    expect(letters(p, id)[0].body).toContain('she is in your Students now');
    expect(ensureCatchUpJoins(p, NOW + 1)).toEqual([]);
    expect(letters(p, id)).toHaveLength(1);
  });

  it(`a save that has not cleared ${stage} gets nothing, and the ${winStage} win still grants ${name}`, () => {
    const p = clearedUpTo(prevStage(stage));
    expect(ensureCatchUpJoins(p, NOW)).not.toContain(id);
    expect(isOwned(p, id)).toBe(false);
    expect(p.missions.counters[JOIN_PREFIX + id]).toBeUndefined();
    expect(letters(p, id)).toHaveLength(0);
    if (winStage !== stage) p.progress.stages[prevStage(winStage)] = medal(); // (1-7 opens after 1-6, 4-7 after 4-6)
    expect(win(p, winStage, 3).unlockedUnits).toEqual([id]);
    expect(p.units[id].dupes || 0).toBe(0);
    expect(ensureCatchUpJoins(p, NOW)).toEqual([]); // the next load only marks her as settled
    expect(p.missions.counters[JOIN_PREFIX + id]).toBe(1);
    expect(letters(p, id)).toHaveLength(0);
  });

  it(`${name} already owned (a recruit) is untouched: no duplicate, no Essence, no letter`, () => {
    const p = clearedUpTo(stage);
    grantUnit(p, id, NOW);
    p.units[id].level = 20;
    p.units[id].dupes = 1;
    const before = clone(p.units[id]);
    const items = clone(p.items);
    expect(ensureCatchUpJoins(p, NOW)).not.toContain(id);
    expect(p.units[id]).toEqual(before);
    expect(p.items).toEqual(items);
    expect(p.missions.counters[JOIN_PREFIX + id]).toBe(1);
    expect(letters(p, id)).toHaveLength(0);
  });

  it(`repeated loads keep one ${name} and one letter`, () => {
    let p = clearedUpTo(stage);
    ensureCatchUpJoins(p, NOW);
    const first = sans(p.units[id]);
    for (let i = 0; i < 4; i++) {
      p = migrateProfile(JSON.parse(saveText(p, i + 2)));
      expect(ensureCatchUpJoins(p, NOW + i)).toEqual([]);
    }
    expect(sans(p.units[id])).toEqual(first);
    expect(letters(p, id)).toHaveLength(1);
    expect(p.mail.delivered.filter((x) => x === joinLetterId(id))).toHaveLength(1);
  });

  it(`a v0.1.39 tab that does not know ${name} drops her; her own: marks bring her back and her join: mark stops a second grant`, () => {
    const p = clearedUpTo(stage);
    expect(ensureCatchUpJoins(p, NOW)).toContain(id);
    p.units[id].level = 7;
    const raw = v0139Save(JSON.parse(saveText(p, 2)));
    expect(raw.units[id]).toBeUndefined(); // that build keeps only the girls it knows
    expect(raw.missions.counters[JOIN_PREFIX + id]).toBe(1); // counters word for word
    expect(raw.missions.counters[OWN_PREFIX + id]).toBeGreaterThan(0);
    raw.progress.stages[stage].clears += 1; // a re-clear there grants nobody (her stage has no unlock in v0.1.39)
    const back = migrateProfile(raw);
    expect(back.units[id].level).toBe(7); // her own: marks
    expect(back.units[id].dupes || 0).toBe(0);
    expect(ensureCatchUpJoins(back, NOW)).toEqual([]);
    expect(letters(back, id)).toHaveLength(1);
    // without her own: marks (a girl truly lost) the join: mark alone still stops a second grant
    const lost = v0139Save(JSON.parse(saveText(back, 3)));
    for (const k of Object.keys(lost.missions.counters)) if (k === OWN_PREFIX + id || k.startsWith(`${OWN_PREFIX}${id}:`)) delete lost.missions.counters[k];
    const again = migrateProfile(lost);
    expect(isOwned(again, id)).toBe(false);
    expect(ensureCatchUpJoins(again, NOW)).toEqual([]);
    expect(isOwned(again, id)).toBe(false);
    expect(letters(again, id)).toHaveLength(1);
  });

  it(`a save that cleared ${stage} on v0.1.39 and comes here gets ${name}; v0.1.39 round trips grant nothing again`, () => {
    let p = viaV0139(clearedUpTo(stage)); // played on v0.1.39 first: no catch-up there
    expect(isOwned(p, id)).toBe(false);
    expect(ensureCatchUpJoins(p, NOW)).toContain(id);
    for (let i = 0; i < 3; i++) {
      p = viaV0139(p, i + 2);
      expect(isOwned(p, id)).toBe(true);
      expect(ensureCatchUpJoins(p, NOW + i)).toEqual([]);
    }
    expect(p.units[id].dupes || 0).toBe(0);
    expect(letters(p, id)).toHaveLength(1);
  });
});

describe('Yuzuha joins after 1-7 now; a 4-2 clear still settles her once', () => {
  /** A save that cleared exactly these stages (Normal). */
  const clearedOnly = (ids) => {
    const p = createProfile();
    for (const id of ids) p.progress.stages[id] = medal();
    return migrateProfile(clone(p));
  };
  const act1Upto = (last) => CAMPAIGN_IDS.slice(0, CAMPAIGN_IDS.indexOf(last) + 1);

  it('a save that cleared 4-2 but never met her (v0.1.39 and before) gets her once, the letter naming 4-2', () => {
    const p = clearedOnly(act1Upto('4-2'));
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['yuzuha', 'azami']);
    expect(letters(p, 'yuzuha')[0].body).toContain('stage 4-2 (Wolves on the Bridge)');
    expect(ensureCatchUpJoins(p, NOW + 1)).toEqual([]);
    expect(letters(p, 'yuzuha')).toHaveLength(1);
  });

  it('a 4-2 win still grants her (with the results card) to a player who has not met her; a 1-7 win grants her', () => {
    const p = clearedOnly(act1Upto('4-1'));
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['azami']);
    expect(win(p, '4-2', 4).unlockedUnits).toEqual(['yuzuha']);
    expect(p.missions.counters[JOIN_PREFIX + 'yuzuha']).toBe(1);
    expect(ensureCatchUpJoins(p, NOW)).toEqual([]); // settled: no letter, no second grant
    expect(letters(p, 'yuzuha')).toHaveLength(0);
    expect(win(p, '4-2', 6).unlockedUnits).toEqual([]); // a re-clear grants nothing
    // a girl lost after her join (an older tab's save) is never granted again by a 4-2 win: her join mark holds
    const lost = clone(p);
    delete lost.units.yuzuha;
    for (const k of Object.keys(lost.missions.counters)) if (k.startsWith(`${OWN_PREFIX}yuzuha`)) delete lost.missions.counters[k];
    const back = migrateProfile(lost);
    expect(win(back, '4-2', 7).unlockedUnits).toEqual([]);
    const q = clearedOnly(act1Upto('1-5').concat('1-6'));
    expect(ensureCatchUpJoins(q, NOW)).toEqual([]);
    expect(win(q, '1-7', 5).unlockedUnits).toEqual(['yuzuha']);
    expect(ensureCatchUpJoins(q, NOW)).toEqual([]);
    expect(letters(q, 'yuzuha')).toHaveLength(0);
    const r = clearedOnly(act1Upto('1-5').concat('1-6', '1-7'));
    expect(ensureCatchUpJoins(r, NOW)).toEqual(['yuzuha']);
    expect(letters(r, 'yuzuha')[0].body).toContain('stage 1-7');
  });

  it('owned already (a recruit, or the v0.1.40 4-2 win): nothing, and the join mark is set once', () => {
    const p = clearedOnly(act1Upto('4-2').concat('1-6', '1-7'));
    grantUnit(p, 'yuzuha', NOW);
    const before = clone(p.units.yuzuha);
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['azami']);
    expect(p.units.yuzuha).toEqual(before);
    expect(p.missions.counters[JOIN_PREFIX + 'yuzuha']).toBe(1);
    expect(letters(p, 'yuzuha')).toHaveLength(0);
    // an older tab that settled her (join mark kept word for word) is never granted again
    const lost = clone(p);
    delete lost.units.yuzuha;
    for (const k of Object.keys(lost.missions.counters)) if (k.startsWith(`${OWN_PREFIX}yuzuha`)) delete lost.missions.counters[k];
    const again = migrateProfile(lost);
    expect(ensureCatchUpJoins(again, NOW)).toEqual([]);
    expect(isOwned(again, 'yuzuha')).toBe(false);
  });
});

describe('Azami joins after 4-7 now; only a 2-2 clear from before this build still brings her', () => {
  const clearedOnly = (ids) => {
    const p = createProfile();
    for (const id of ids) p.progress.stages[id] = medal();
    return migrateProfile(clone(p));
  };
  const act1Upto = (last) => CAMPAIGN_IDS.slice(0, CAMPAIGN_IDS.indexOf(last) + 1);

  it('a save that cleared 2-2 before this build (never met her) gets her on its first load here, the letter naming 2-2', () => {
    const p = clearedOnly(act1Upto('2-2'));
    expect(p.missions.counters[JOIN_WINDOW_PREFIX + 'azami']).toBeUndefined();
    expect(ensureCatchUpJoins(p, NOW)).toEqual(['azami']);
    expect(letters(p, 'azami')[0].body).toContain('stage 2-2 (Through the Reeds)');
    expect(p.missions.counters[JOIN_WINDOW_PREFIX + 'azami']).toBe(1);
    expect(ensureCatchUpJoins(p, NOW + 1)).toEqual([]);
  });

  it('a new player: the first load closes the window; a later 2-2 clear or win never brings her; the 4-7 win does', () => {
    const p = createProfile();
    expect(ensureCatchUpJoins(p, NOW)).toEqual([]);
    expect(p.missions.counters[JOIN_WINDOW_PREFIX + 'azami']).toBe(1);
    expect(p.missions.counters[JOIN_PREFIX + 'azami']).toBeUndefined();
    p.progress.stages['2-1'] = medal();
    expect(win(p, '2-2', 3).unlockedUnits).toEqual([]);
    expect(isOwned(p, 'azami')).toBe(false);
    // the window survives a save and a reload (counters are kept word for word)
    const q = migrateProfile(JSON.parse(saveText(p, 2)));
    expect(ensureCatchUpJoins(q, NOW)).toEqual([]);
    expect(isOwned(q, 'azami')).toBe(false);
    for (const id of act1Upto('4-5').concat(...[1, 2, 3].flatMap((c) => [6, 7, 8, 9, 10].map((n) => `${c}-${n}`)), '4-6')) q.progress.stages[id] = medal();
    expect(ensureCatchUpJoins(q, NOW)).toEqual(['yuzuha']); // (1-7 marked cleared here without its win)
    expect(win(q, '4-7', 4).unlockedUnits).toEqual(['azami']);
    expect(ensureCatchUpJoins(q, NOW)).toEqual([]);
    expect(q.missions.counters[JOIN_PREFIX + 'azami']).toBe(1);
    expect(letters(q, 'azami')).toHaveLength(0);
  });

  it('a save that already owns her (every v0.1.40+ save past 2-2) keeps her; nothing is granted twice', () => {
    const p = clearedOnly(act1Upto('3-1'));
    grantUnit(p, 'azami', NOW);
    p.missions.counters[JOIN_PREFIX + 'azami'] = 1;
    const before = clone(p.units.azami);
    expect(ensureCatchUpJoins(p, NOW)).toEqual([]);
    expect(p.units.azami).toEqual(before);
    p.progress.stages['4-6'] = medal();
    expect(win(p, '4-7', 5).unlockedUnits).toEqual([]);
    expect(p.units.azami.dupes || 0).toBe(0);
  });
});

describe('catch-up joins and older tabs', () => {
  it('a v0.1.39 tab that loads and saves keeps Noa and Hana and every mark; back here nothing happens twice', () => {
    const p = clearedUpTo('7-5');
    ensureCatchUpJoins(p, NOW);
    const old = migrateProfile(v0139Save(JSON.parse(saveText(p, 1)))); // that build's app start never runs the catch-up
    expect(isOwned(old, 'noa') && isOwned(old, 'hana')).toBe(true);
    for (const id of ALL_JOINS) expect(old.missions.counters[JOIN_PREFIX + id], id).toBe(1);
    old.progress.stages['6-2'].clears += 1; // and a 6-2 win there grants nobody (she is owned)
    const back = migrateProfile(JSON.parse(saveText(old, 3)));
    expect(ensureCatchUpJoins(back, NOW)).toEqual([]);
    expect(back.units.noa.dupes || 0).toBe(0);
    for (const id of ALL_JOINS) {
      expect(isOwned(back, id), id).toBe(true);
      expect(letters(back, id), id).toHaveLength(1);
    }
  });

  it('a v0.1.38 tab drops the returning and the new girls; their own marks bring them back and the join marks stop a second grant', () => {
    const p = clearedUpTo('7-5');
    ensureCatchUpJoins(p, NOW);
    p.units.noa.level = 8; // (gate 0 caps her at 10)
    p.units.wakaba.level = 9;
    grantUnit(p, 'hana', NOW); // a duplicate later on (a select ticket): 1 Essence
    const raw = v0138Save(JSON.parse(saveText(p, 2)));
    for (const id of ALL_JOINS) {
      expect(raw.units[id], id).toBeUndefined();
      expect(raw.missions.counters[JOIN_PREFIX + id], id).toBe(1);
    }
    const back = migrateProfile(raw);
    expect(back.units.noa.level).toBe(8);
    expect(back.units.wakaba.level).toBe(9);
    expect(back.units.hana.dupes).toBe(1);
    expect(ensureCatchUpJoins(back, NOW)).toEqual([]);
    expect(back.units.hana.dupes).toBe(1);
    for (const id of ALL_JOINS) expect(letters(back, id), id).toHaveLength(1);
  });

  it('a v0.1.38 save that cleared 6-2 loads in v0.1.39 without Noa and gets her (and Azami, Yuzuha) here, once', () => {
    const p = clearedUpTo('6-3');
    const raw = v0138Save(JSON.parse(saveText(p, 1)));
    const old = migrateProfile(v0139Save(migrateProfile(raw)));
    expect(isOwned(old, 'noa')).toBe(false); // v0.1.39 grants her only on a new 6-2 win
    const here = migrateProfile(JSON.parse(saveText(old, 2)));
    expect(ensureCatchUpJoins(here, NOW)).toEqual(['yuzuha', 'azami', 'noa']);
    // the next v0.1.38 round trip loses nothing and grants nothing again
    const again = migrateProfile(v0138Save(JSON.parse(saveText(here, 3))));
    for (const id of ['azami', 'yuzuha', 'noa']) expect(isOwned(again, id), id).toBe(true);
    expect(ensureCatchUpJoins(again, NOW)).toEqual([]);
    expect(letters(again, 'noa')).toHaveLength(1);
    expect(joinLetters(again)).toHaveLength(3);
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

  it('a stale tab opened before the update never writes them away, and a reload grants nothing twice', () => {
    ls.setItem(SAVE_KEY, JSON.stringify(clearedUpTo('7-5')));
    const oldTab = createStore({ debounceMs: 0 });
    oldTab.load(); // still on the older build: no catch-up at its start
    const newTab = createStore({ debounceMs: 0 });
    newTab.load();
    expect(ensureCatchUpJoins(newTab.profile, NOW)).toEqual(ALL_JOINS);
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
      for (const id of ALL_JOINS) expect(isOwned(tab.profile, id), id).toBe(true);
      expect(ensureCatchUpJoins(tab.profile, NOW)).toEqual([]);
      for (const id of ALL_JOINS) expect(letters(tab.profile, id), id).toHaveLength(1);
      tab.saveNow();
    }
  });
});

// Battle saves in the profile (src/systems/battleSave.js + save.js): the field survives every
// load path, broken records are dropped one by one (never the whole save, never a backup
// prompt), the cap keeps the newest, a clear only removes its own run, and the payout helpers
// (run-seeded drops, the event bonus by start time) are deterministic.
import { describe, it, expect } from 'vitest';
import {
  RECORD_V, SNAP_V, MAX_BATTLE_SAVES, slotKey, isSavableRun, getBattleSave, listBattleSaves, putBattleSave, saveToEvict, savesByWorth,
  clearBattleSave, saveSummary, cleanBattleSaves, droppedBattleSaves, droppedBattleSaveNames, newRunId, agoText, saveTitle,
} from '../../src/systems/battleSave.js';
import {
  createProfile, migrateProfile, migrationDropsData, loadSaveText, serializeProfile, deserializeProfile,
} from '../../src/systems/save.js';
import { battleDropSeed, eventMul, battleEventMul, applyBattleResult } from '../../src/systems/rewards.js';
import { currentEvent } from '../../src/systems/missions.js';
import { createRng } from '../../src/core/rng.js';

/** A minimal valid record (stage 1-1, saved between waves 2 and 3). */
const rec = (over = {}, snapOver = {}) => ({
  v: RECORD_V,
  id: 'bs-test-1',
  slot: '1-1',
  stageId: '1-1',
  endless: false,
  difficulty: 'normal',
  seed: 3735928559,
  loadout: [{ unitId: 'aoi', stats: { damageMul: 1.2 } }, { unitId: 'rei', stats: { damageMul: 1 } }],
  hero: { unitId: 'hikari', stats: { damageMul: 1 } },
  createdAt: 1000,
  updatedAt: 2000,
  build: { app: '0.1.dev', sim: 'dev' },
  resumes: 0,
  view: { next: 3, of: 12, lives: 100, difficulty: 'normal' },
  snap: {
    v: SNAP_V, wave: 2, wavesCleared: 2, state: 'between', time: 61.5, cash: 480, carry: 0.25, lives: 97, uid: 12, buffs: [],
    towers: [
      { uid: 1, u: 'aoi', x: 4.25, y: 3.75, tiers: [1, 0, 0], tm: 'first', spent: 300, kills: 9, dmg: 400, cd: 0, dis: 0, face: 1, bt: 0 },
      { uid: 4, u: 'retired-girl', x: 6.25, y: 3.75, tiers: [0, 0, 0], tm: 'strong', spent: 200, kills: 1, dmg: 50, cd: 0, dis: 0, face: 0, bt: 0 },
    ],
    kills: { slime: 10 },
    enc: ['slime'],
    stats: { leaks: 3 },
    ...snapOver,
  },
  ...over,
});
const saves = (...list) => Object.fromEntries(list.map((r) => [r.slot, r]));
const roundTrip = (p) => migrateProfile(JSON.parse(JSON.stringify(p)));

describe('profile.battleSaves', () => {
  it('a new profile has none', () => {
    expect(createProfile().battleSaves).toEqual({});
  });

  it('a valid record survives load / migrate (the allowlist keeps the field)', () => {
    const p = createProfile();
    p.battleSaves = saves(rec());
    const back = roundTrip(p);
    expect(back.battleSaves['1-1']).toEqual(rec());
    // a tower of a unit this build does not know stays: Continue refunds her
    expect(back.battleSaves['1-1'].snap.towers.map((t) => t.u)).toEqual(['aoi', 'retired-girl']);
    expect(migrateProfile({ ...JSON.parse(JSON.stringify(createProfile())), battleSaves: undefined }).battleSaves).toEqual({});
  });

  it('records travel with export / import and transfer codes', () => {
    const p = createProfile();
    p.battleSaves = saves(rec(), rec({ id: 'bs-2', slot: 'challenge', stageId: 'challenge', endless: true }));
    expect(deserializeProfile(serializeProfile(p)).battleSaves).toEqual(p.battleSaves);
  });

  it('drops each broken record on its own', () => {
    const bad = {
      'not an object': 5,
      'slot mismatch': rec({ slot: '1-2' }),
      'unknown stage': rec({ slot: 'nope-1', stageId: 'nope-1' }),
      'bad difficulty': rec({ difficulty: 'insane' }),
      'seed not uint32': rec({ seed: -4 }),
      'seed fraction': rec({ seed: 1.5 }),
      'newer record': rec({ v: RECORD_V + 1 }),
      'newer snapshot': rec({}, { v: SNAP_V + 1 }),
      'mid-wave state': rec({}, { state: 'wave' }),
      'cash not finite': rec({}, { cash: 'lots' }),
      'lives not finite': rec({}, { lives: null }),
      'wave not finite': rec({}, { wave: Infinity }),
      'time missing': rec({}, { time: undefined }),
      'duplicate uids': rec({}, { towers: [{ uid: 2, u: 'aoi' }, { uid: 2, u: 'rei' }] }),
      'zero uid': rec({}, { towers: [{ uid: 0, u: 'aoi' }] }),
      'no team': rec({ loadout: [], hero: null }),
      'no id': rec({ id: '' }),
      'no snapshot': rec({ snap: null }),
    };
    for (const [why, r] of Object.entries(bad)) {
      const slot = r?.slot ?? 'x';
      expect(cleanBattleSaves({ [slot]: r }), why).toEqual({});
    }
    // the good one next to them stays
    const good = rec({ id: 'ok', slot: '1-2', stageId: '1-2' });
    expect(Object.keys(cleanBattleSaves({ ...saves(good), 'bad': 7, '1-1': rec({ difficulty: 'x' }) }))).toEqual(['1-2']);
    // endless slots: the Colosseum keeps its id; a campaign map's old endless run (its own slot,
    // from a build before Freeplay) is Freeplay now, which never saves: nothing can continue it
    expect(Object.keys(cleanBattleSaves(saves(rec({ id: 'col', slot: 'challenge', stageId: 'challenge', endless: true }))))).toEqual(['challenge']);
    expect(cleanBattleSaves(saves(rec({ slot: '1-1:endless', endless: true })))).toEqual({});
    expect(droppedBattleSaveNames({ battleSaves: saves(rec({ slot: '1-1:endless', endless: true })) })).toEqual(['Endless 1-1 (wave 3)']);
    expect(cleanBattleSaves({ '1-1': rec({ endless: true }) })).toEqual({});
  });

  it('keeps the newest MAX_BATTLE_SAVES by last play', () => {
    const many = ['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2'].map((id, i) => rec({ id: `bs-${i}`, slot: id, stageId: id, updatedAt: 100 + i }));
    const kept = cleanBattleSaves(saves(...many));
    expect(Object.keys(kept).length).toBe(MAX_BATTLE_SAVES);
    expect(Object.keys(kept).sort()).toEqual(['1-3', '1-4', '1-5', '2-1', '2-2']);
  });

  it('a save past the end of a stage an update made shorter is dropped (no "wave 15 of 14")', () => {
    const waves = 12; // 1-1
    expect(cleanBattleSaves(saves(rec({}, { wave: waves - 1 })))['1-1']).toBeTruthy();
    expect(cleanBattleSaves(saves(rec({}, { wave: waves })))).toEqual({});
    // endless runs have no end
    const col = rec({ slot: 'challenge', stageId: 'challenge', endless: true }, { wave: 120 });
    expect(cleanBattleSaves(saves(col)).challenge).toBeTruthy();
  });

  it('a battle mode travels with its record; Standard is the absent field; a mode this build does not know drops the record', () => {
    expect(cleanBattleSaves(saves(rec({ mode: 'rush' })))['1-1'].mode).toBe('rush');
    expect('mode' in cleanBattleSaves(saves(rec({ mode: 'standard' })))['1-1']).toBe(false);
    expect('mode' in cleanBattleSaves(saves(rec()))['1-1']).toBe(false);
    expect(cleanBattleSaves(saves(rec({ mode: 'turbo' })))).toEqual({});
    expect(cleanBattleSaves(saves(rec({ mode: 7 })))).toEqual({});
    expect(roundTrip({ ...createProfile(), battleSaves: saves(rec({ mode: 'laststand' })) }).battleSaves['1-1'].mode).toBe('laststand');
  });

  it('a record without a start time counts from its last play (never the 1970 event week)', () => {
    expect(cleanBattleSaves(saves(rec({ createdAt: undefined, updatedAt: 5000 })))['1-1'].createdAt).toBe(5000);
    expect(cleanBattleSaves(saves(rec({ createdAt: 0, updatedAt: 0 })))['1-1'].createdAt).toBeGreaterThan(1e12);
  });

  it('a dropped record is not a lossy migration (no whole-save backup), but it is counted and named for a notice', () => {
    const raw = JSON.parse(JSON.stringify(createProfile()));
    raw.battleSaves = { ...saves(rec()), '1-2': rec({ slot: '1-2', stageId: '1-2', v: 99 }, { wave: 4 }) };
    expect(migrationDropsData(raw)).toBe(false);
    expect(droppedBattleSaves(raw)).toBe(1);
    expect(droppedBattleSaveNames(raw)).toEqual(['Mission 1-2 (wave 5)']);
    const res = loadSaveText(JSON.stringify(raw));
    expect(res.backup).toBeNull();
    expect(res.droppedBattles).toBe(1);
    expect(Object.keys(res.profile.battleSaves)).toEqual(['1-1']);
  });
});

describe('battle save slots and modes', () => {
  it('slotKey: one slot per stage, endless runs on a map apart, the Colosseum as itself', () => {
    expect(slotKey('3-5')).toBe('3-5');
    expect(slotKey('3-5', false)).toBe('3-5');
    expect(slotKey('3-5', true)).toBe('3-5:endless');
    expect(slotKey('challenge', true)).toBe('challenge');
    expect(slotKey('challenge')).toBe('challenge');
    expect(slotKey('res-books-2')).toBe('res-books-2');
  });

  it('isSavableRun: campaign / Bounty / Assault / Colosseum / endless yes; co-op, clan boss, tutorial, practice, solo freeplay no', () => {
    const ok = { practice: false, error: null };
    expect(isSavableRun({ stage: '1-1' }, ok)).toBe(true);
    expect(isSavableRun({ stage: 'challenge' }, ok)).toBe(true);
    expect(isSavableRun({ stage: '1-1', endless: '1' }, ok)).toBe(true);
    // a normal run that may Keep going is saved; a solo freeplay run (freeplay=<tier>, or endless=1
    // on a cleared campaign map) never is
    expect(isSavableRun({ stage: '1-1' }, { ...ok, freeplay: null, keepGoing: true })).toBe(true);
    expect(isSavableRun({ stage: '1-1', freeplay: 'tempest' }, { ...ok, freeplay: 'tempest' })).toBe(false);
    expect(isSavableRun({ stage: '1-1', endless: '1' }, { ...ok, freeplay: 'blossom' })).toBe(false);
    expect(isSavableRun({ coop: 'ABCD' }, ok)).toBe(false);
    expect(isSavableRun({ stage: 'boss-lych', clanBoss: '42' }, ok)).toBe(false);
    expect(isSavableRun({ stage: '1-1', tutorial: '1' }, ok)).toBe(false);
    expect(isSavableRun({ stage: '8-5' }, { practice: true, error: null })).toBe(false);
    expect(isSavableRun({ stage: 'nope' }, { practice: false, error: 'Unknown stage' })).toBe(false);
    // a Sandbox run (endless on a host stage) never saves: it would take that stage's real slot
    expect(isSavableRun({ stage: '1-1', sandbox: '1', team: 'kage' }, { ...ok, endless: true, sandbox: true })).toBe(false);
  });
});

describe('battle save records', () => {
  it('put / get / list (newest first); when full, the save with the least play is the one offered to go', () => {
    const p = createProfile();
    // 1-1 at wave 9 of 12, 1-2 at wave 2 of 14 (least play), 1-3 at wave 2 of 15 played most recently
    // (still less), the Colosseum at wave 30 (endless: always kept longest), 1-4 at wave 7 of 15
    const list = [
      rec({ id: 'bs-a', slot: '1-1', stageId: '1-1', updatedAt: 10 }, { wave: 9 }),
      rec({ id: 'bs-b', slot: '1-2', stageId: '1-2', updatedAt: 11 }, { wave: 2 }),
      rec({ id: 'bs-c', slot: '1-3', stageId: '1-3', updatedAt: 14 }, { wave: 2 }),
      rec({ id: 'bs-d', slot: 'challenge', stageId: 'challenge', endless: true, updatedAt: 1 }, { wave: 30 }),
      rec({ id: 'bs-e', slot: '1-4', stageId: '1-4', updatedAt: 12 }, { wave: 7 }),
    ];
    for (const r of list) putBattleSave(p, r);
    expect(listBattleSaves(p).map((r) => r.slot)).toEqual(['1-3', '1-4', '1-2', '1-1', 'challenge']);
    expect(savesByWorth(p).map((r) => r.id)).toEqual(['bs-c', 'bs-b', 'bs-e', 'bs-a', 'bs-d']);
    expect(saveToEvict(p, '1-3')).toBeNull(); // overwrites its own slot
    expect(saveToEvict(p, '2-1').id).toBe('bs-c');
    // the Colosseum's wave-30 run, the least recently played, is never the first to go
    expect(savesByWorth(p).at(-1).slot).toBe('challenge');
    const evicted = putBattleSave(p, rec({ id: 'bs-new', slot: '2-1', stageId: '2-1', updatedAt: 99 }));
    expect(evicted.map((r) => r.id)).toEqual(['bs-c']);
    expect(getBattleSave(p, '1-3')).toBeNull();
    expect(getBattleSave(p, '2-1').id).toBe('bs-new');
    expect(getBattleSave(p, 'challenge').id).toBe('bs-d');
    expect(listBattleSaves(p).length).toBe(MAX_BATTLE_SAVES);
  });

  it('saveTitle: the stage name, and the kind of battle on a second line where the name does not say it', () => {
    expect(saveTitle(rec())).toEqual({ name: 'Mission 1-1', mode: null });
    expect(saveTitle(rec({ slot: '2-4:endless', stageId: '2-4', endless: true }))).toEqual({ name: 'Endless 2-4', mode: null });
    const col = saveTitle(rec({ slot: 'challenge', stageId: 'challenge', endless: true }));
    expect(col.mode).toBe('Endless');
    expect(col.name).toBeTruthy();
    expect(saveTitle(rec({ slot: 'boss-lych', stageId: 'boss-lych' }))).toEqual({ name: 'Grave Lych', mode: 'Total Assault' });
    expect(saveTitle(rec({ slot: 'res-books-2', stageId: 'res-books-2' }))).toEqual({ name: 'Library Courtyard II', mode: 'Bounty' });
    expect(saveTitle({ stageId: 'gone-9' })).toEqual({ name: 'gone-9', mode: null });
  });

  it('clearBattleSave with another run id keeps the record (a payout never deletes a newer run)', () => {
    const p = createProfile();
    putBattleSave(p, rec());
    expect(clearBattleSave(p, '1-1', 'bs-someone-else')).toBe(false);
    expect(getBattleSave(p, '1-1')).not.toBeNull();
    expect(clearBattleSave(p, '1-1', 'bs-test-1')).toBe(true);
    expect(getBattleSave(p, '1-1')).toBeNull();
    putBattleSave(p, rec());
    expect(clearBattleSave(p, '1-1')).toBe(true); // New game / Restart: whatever is there
    expect(clearBattleSave(p, '1-1')).toBe(false);
  });

  it('saveSummary: the next wave to fight, of the total (none for endless), lives and age', () => {
    const now = 2000 + 12 * 60 * 1000;
    expect(saveSummary(rec(), now)).toEqual({ next: 3, of: 12, lives: 97, difficulty: 'normal', endless: false, ago: '12 min ago' });
    const col = rec({ slot: 'challenge', stageId: 'challenge', endless: true }, { wave: 30 });
    expect(saveSummary(col, now)).toMatchObject({ next: 31, of: null, endless: true });
    expect(saveSummary(rec({}, { wave: 0, state: 'prep' }), now).next).toBe(1);
    expect(agoText(0, 30 * 1000)).toBe('just now');
    expect(agoText(0, 3 * 3600 * 1000)).toBe('3 h ago');
    expect(agoText(0, 49 * 3600 * 1000)).toBe('2 d ago');
  });

  it('newRunId is unique per run and URL-safe', () => {
    const a = newRunId(1700000000000, () => 0.1);
    const b = newRunId(1700000000000, () => 0.2);
    expect(a).toMatch(/^bs-[a-z0-9]+-[0-9a-f]{5}$/);
    expect(a).not.toBe(b);
    expect(encodeURIComponent(newRunId())).toMatch(/^bs-/);
  });
});

describe('payout helpers', () => {
  it('battleDropSeed is fixed by the run', () => {
    expect(battleDropSeed('3-5', 'hard', 77)).toBe(battleDropSeed('3-5', 'hard', 77));
    expect(battleDropSeed('3-5', 'hard', 77)).not.toBe(battleDropSeed('3-5', 'hard', 78));
    expect(battleDropSeed('3-5', 'hard', 77)).not.toBe(battleDropSeed('3-5', 'normal', 77));
    expect(Number.isInteger(battleDropSeed('3-5', 'hard', 77))).toBe(true);
  });

  it('the event bonus is judged by when the run started (eventAt), and only while it finishes within 48 h of that week', () => {
    // two weeks: one where a Bounty arena has the 2× event, one where it does not
    const week = 7 * 24 * 3600 * 1000;
    const hour = 3600 * 1000;
    const t0 = Date.UTC(2026, 9, 14, 12);
    let on = null;
    let off = null;
    let stageId = null;
    for (let i = 0; i < 30 && !(on && off); i++) {
      const at = new Date(t0 + i * week);
      const ev = currentEvent(at);
      stageId ||= ev.stageIds[0];
      if (ev.stageIds.includes(stageId)) on ||= at;
      else off ||= at;
    }
    expect(on && off).toBeTruthy();
    expect(eventMul(stageId, on)).toBe(2);
    expect(eventMul(stageId, off)).toBe(1);
    // the first hour of the week after the event week
    let end = on.getTime();
    while (currentEvent(new Date(end)).week === currentEvent(on).week) end += hour;
    const won = { stageId, difficulty: 'normal', won: true, wave: 12, wavesCleared: 12, livesLeft: 100, encountered: [], kills: {}, stats: {} };
    const unlockAll = (p) => {
      for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '2-4', '2-5']) p.progress.stages[id] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
      return p;
    };
    const bonus = (now, eventAt) => applyBattleResult(unlockAll(createProfile()), won, createRng(1), { now: new Date(now), eventAt: eventAt && new Date(eventAt) }).eventBonus;
    // started in the event week, finished in it or up to 48 h after it: the bonus
    expect(bonus(on.getTime() + hour, on)).toBe(true);
    expect(bonus(end + 24 * hour, on)).toBe(true);
    expect(battleEventMul(stageId, new Date(end + 47 * hour), on)).toBe(2);
    // kept longer than that: no bonus (a save cannot be banked for weeks and still paid double)
    expect(bonus(end + 49 * hour, on)).toBe(false);
    expect(bonus(end + 3 * week, on)).toBe(false);
    // started before the event week, finished inside it: no bonus (no stockpiled saves)
    expect(bonus(on.getTime(), off)).toBe(false);
    // without eventAt, as before: the finish time
    expect(bonus(on.getTime())).toBe(true);
  });
});

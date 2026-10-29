import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  crosspathReason, pathCap, onePerPathReason, whereOnMap, finalHolderLine, finalRaceText, heldPipTitle, ONE_PER_PATH_RULE, FINAL_NUMERAL,
} from '../../src/ui/battle/rules.js';
import { resolveFormation, parseBattleParams, createBattleSim, resumeBattleSim, followingStage, mapRouteFor } from '../../src/ui/battle/setup.js';
import { createProfile, SAVE_KEY } from '../../src/systems/save.js';
import { store } from '../../src/core/store.js';
import { clearBattleSave } from '../../src/systems/battleSave.js';
import { createBattleSaver } from '../../src/ui/battle/battleSaver.js';
import { createResults } from '../../src/ui/battle/results.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { createRng } from '../../src/core/rng.js';
import { feedDockRight, feedLayout } from '../../src/ui/battle/feed.js';

const NAMES = ['A', 'B', 'C'];

describe('crosspath rules', () => {
  it('caps the third path once two are in use', () => {
    expect(pathCap([1, 1, 0], 2)).toBe(0);
    expect(crosspathReason([1, 1, 0], 2, NAMES)).toMatch(/A \+ B/);
  });
  it('caps other paths at tier 2 when one passes tier 2', () => {
    expect(pathCap([3, 0, 0], 1)).toBe(2);
    expect(pathCap([3, 0, 0], 0)).toBe(5);
    expect(crosspathReason([3, 2, 0], 1, NAMES)).toMatch(/A is already T3/);
  });
  it('agrees with the sim for every reachable tier combination', () => {
    const profile = createProfile();
    const { sim } = createBattleSim(profile, { stageId: '1-1', difficulty: 'normal', seed: 7 });
    sim.cash = 1e9;
    const unitId = [...sim.loadout.keys()][0];
    let spot = null;
    for (let y = 0; y < sim.map.height && !spot; y++) for (let x = 0; x < sim.map.width; x++) if (sim.canPlace(unitId, x, y).ok) { spot = [x, y]; break; }
    for (const combo of [[0, 0, 0], [2, 2, 0], [3, 1, 0], [0, 2, 5], [1, 0, 1], [5, 2, 0]]) {
      const t = sim.placeTower(unitId, ...spot);
      for (let p = 0; p < 3; p++) for (let k = 0; k < combo[p]; k++) expect(sim.upgradeTower(t.uid, p)).toBe(true);
      for (let p = 0; p < 3; p++) {
        const st = sim.upgradeStatus(t.uid, p);
        const capped = t.tiers[p] >= pathCap(t.tiers, p);
        if (t.tiers[p] < 5) expect(st.reason === 'crosspath').toBe(capped);
      }
      sim.sellTower(t.uid);
    }
  });
});

describe('one final tier per path (copy)', () => {
  it('says who can hold the final tier, in the owner\'s words', () => {
    expect(FINAL_NUMERAL).toBe('V');
    expect(onePerPathReason('Chika', 'Sentry Works')).toBe('Only one Chika can hold Sentry Works V. Sell or upgrade that one.');
    expect(finalRaceText('Kage', 'Storm of Steel')).toBe('Another Kage took Storm of Steel V first.');
    expect(heldPipTitle('Thousand Shadows', 'Kage')).toBe('T5 Thousand Shadows — held by another Kage');
    expect(ONE_PER_PATH_RULE).toMatch(/one 5-x-x, one x-5-x and one x-x-5/);
  });
  it('names where the holder stands (thirds of the map)', () => {
    expect(whereOnMap(1, 1, 30, 18)).toBe('top left');
    expect(whereOnMap(15, 1, 30, 18)).toBe('top');
    expect(whereOnMap(29, 1, 30, 18)).toBe('top right');
    expect(whereOnMap(1, 9, 30, 18)).toBe('left');
    expect(whereOnMap(15, 9, 30, 18)).toBe('centre');
    expect(whereOnMap(29, 9, 30, 18)).toBe('right');
    expect(whereOnMap(1, 17, 30, 18)).toBe('bottom left');
    expect(whereOnMap(15, 17, 30, 18)).toBe('bottom');
    expect(whereOnMap(29, 17, 30, 18)).toBe('bottom right');
    expect(whereOnMap(3, 3, 0, 0)).toBe('centre');
    expect(finalHolderLine({ def: { name: 'Chika' }, tiers: [5, 0, 2] }, 'bottom left')).toBe('Held by Chika 5-0-2 · bottom left');
  });
});

describe('battle setup', () => {
  it('builds the loadout from the formation (towers ≤ 8, starter hero)', () => {
    const profile = createProfile();
    const f = resolveFormation(profile);
    expect(f.towers.length).toBeGreaterThan(0);
    expect(f.towers.length).toBeLessThanOrEqual(8);
    expect(f.hero).toBe('hikari');
  });
  it('drops units the player does not own', () => {
    const profile = createProfile();
    profile.formation.towers = ['kaede', 'aoi', 'aoi'];
    const f = resolveFormation(profile);
    expect(f.towers).toEqual(['aoi']);
  });
  it('validates route params', () => {
    const profile = createProfile();
    expect(parseBattleParams({ stage: 'nope' }, profile).error).toBeTruthy();
    const r = parseBattleParams({ stage: '1-1', difficulty: 'weird' }, profile);
    expect(r.error).toBeNull();
    expect(r.difficulty).toBe('normal');
    expect(parseBattleParams({ stage: '3-1' }, profile).practice).toBe(true);
    expect(parseBattleParams({ stage: '1-1' }, profile).practice).toBe(false);
  });
  it('only honours endless=1 where the Tactical Challenge screen offers it (as freeplay on campaign maps)', () => {
    const profile = createProfile();
    // 1-1 is unlocked but not cleared yet; 8-5 is locked (practice) — no freeplay on either
    expect(parseBattleParams({ stage: '1-1', endless: '1' }, profile)).toMatchObject({ endless: false, freeplay: null });
    expect(parseBattleParams({ stage: '8-5', difficulty: 'easy', endless: '1' }, profile)).toMatchObject({ endless: false, freeplay: null, practice: true });
    profile.progress.stages['1-1'] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 };
    // the old endless run on a campaign map is a freeplay run now (Blossom unless a tier is given)
    expect(parseBattleParams({ stage: '1-1', endless: '1' }, profile)).toMatchObject({ endless: false, freeplay: 'blossom' });
    expect(parseBattleParams({ stage: '1-1' }, profile)).toMatchObject({ endless: false, freeplay: null, keepGoing: true });
    // the colosseum is endless by nature (a locked one is a practice run)
    expect(parseBattleParams({ stage: 'challenge' }, profile)).toMatchObject({ endless: true, practice: true });
    // the sim follows the request
    const { sim } = createBattleSim(profile, parseBattleParams({ stage: '1-1', endless: '1' }, profile));
    expect(sim.endless).toBe(false);
    expect(sim.freeplay).toBe(true);
    expect(sim.stage.freeplay.id).toBe('blossom');
  });
  it('creates a playable sim with unitBattleStats', () => {
    const profile = createProfile();
    const { sim, towers, hero } = createBattleSim(profile, { stageId: '1-1', difficulty: 'easy', seed: 3 });
    expect(sim.state).toBe('prep');
    expect([...sim.loadout.keys()]).toEqual(towers);
    expect(sim.heroConfig?.unitId).toBe(hero);
  });
  it('routes Next stage / Back to map', () => {
    expect(followingStage('1-1')).toBe('1-2');
    expect(followingStage('8-5')).toBeNull();
    expect(mapRouteFor(STAGE_MAP['1-3']).name).toBe('campaign');
    const boss = Object.values(STAGE_MAP).find((s) => s.kind === 'boss');
    expect(mapRouteFor(boss).name).toBe('assault');
  });
  it('a finished sim result feeds applyBattleResult', () => {
    const profile = createProfile();
    const { sim } = createBattleSim(profile, { stageId: '1-1', difficulty: 'easy', seed: 11 });
    for (let i = 0; i < 4000 && sim.state !== 'lost' && sim.state !== 'won'; i++) {
      if (sim.state !== 'wave') sim.startNextWave();
      sim.update(0.25);
    }
    expect(sim.state).toBe('lost');
    const out = applyBattleResult(profile, sim.result(), createRng(1), { now: new Date() });
    expect(out.firstClear).toBe(false);
    expect(Array.isArray(out.rewards)).toBe(true);
  });
});

describe('toast feed docking (keeps spawn gates in view)', () => {
  const box = { width: 1280, w: 340, top: 70, hgt: 176 };
  it('stays top-left on desktop unless a spawn run sits under it', () => {
    expect(feedDockRight([], box)).toBe(false);
    // a spawn gate at the top-left (e.g. foundry_core (-1,1.5)) pushes the feed to the right
    expect(feedDockRight([{ x: 40, y: 120 }, { x: 90, y: 150 }], box)).toBe(true);
    // spawns on both sides: the side covering fewer stays clear
    expect(feedDockRight([{ x: 40, y: 120 }, { x: 1200, y: 120 }, { x: 1150, y: 140 }], box)).toBe(false);
  });
  it('exit runs only break ties: a spawn always outweighs an exit', () => {
    const exitRight = [{ x: 1200, y: 120, w: 0.2 }, { x: 1180, y: 130, w: 0.2 }, { x: 1160, y: 140, w: 0.2 }];
    expect(feedDockRight([{ x: 40, y: 120 }, ...exitRight], box)).toBe(true);
    const exitLeft = exitRight.map((p) => ({ ...p, x: 1280 - p.x }));
    // landscape phones prefer the right corner, but leave it for an exit gate there
    expect(feedDockRight(exitLeft, { ...box, preferRight: true })).toBe(true);
    expect(feedDockRight(exitRight, { ...box, preferRight: true })).toBe(false);
    // points below the feed never count
    expect(feedDockRight([{ x: 40, y: 400 }], box)).toBe(false);
    // gate points only place feedLayout's drop: they never change the corner
    expect(feedDockRight([{ x: 40, y: 120, gate: true, r: 40 }], box)).toBe(false);
  });
  it('both top corners over a spawn (6-10\'s two Vesper Gates): the feed drops below the gates, ≤ 2 toasts with a boss up', () => {
    const lim = { ...box, limit: 720 * 0.72 };
    // 1280×720: a gate in each top corner (its road runs down from it), the left corner kept (fewer hits)
    const gate = (x, y) => [{ x, y, gate: true, r: 60 }, { x, y }, { x, y: y + 60 }];
    const both = [...gate(290, 130), ...gate(985, 130), { x: 1000, y: 150 }];
    expect(feedLayout(both, lim)).toEqual({ right: false, top: 198, cap: 2, capAlways: false });
    // 844×390 (prefers right): the drop clears the right gate
    const phone = { width: 844, w: 350, top: 58, hgt: 2 * 26 + 16, preferRight: true, limit: 390 * 0.72 };
    const g = [...gate(260, 85).map((p) => ({ ...p, r: p.r && 32 })), ...gate(585, 85).map((p) => ({ ...p, r: p.r && 32 }))];
    const lay = feedLayout(g, phone);
    expect(lay.right).toBe(true);
    expect(lay.top).toBeGreaterThanOrEqual(85 + 32);
    expect(lay.top + phone.hgt).toBeLessThanOrEqual(phone.limit);
    // no room under the gates: no drop, capped at 2 at all times
    expect(feedLayout(both, { ...box, limit: 300 })).toEqual({ right: false, top: null, cap: 2, capAlways: true });
  });
  it('a board with at most one corner over a spawn behaves exactly as before (no drop, no cap)', () => {
    const lim = { ...box, limit: 518 };
    const cases = [
      [],
      [{ x: 40, y: 120 }, { x: 90, y: 150 }, { x: 40, y: 120, gate: true, r: 50 }],
      [{ x: 1200, y: 120 }, { x: 1200, y: 120, gate: true, r: 50 }],
      // an exit in the other corner never counts as a spawn
      [{ x: 40, y: 120 }, { x: 1200, y: 120, w: 0.2 }, { x: 1200, y: 120, w: 0.2, gate: true, r: 50 }],
      // a spawn below the feed band
      [{ x: 40, y: 120 }, { x: 1200, y: 400 }, { x: 1200, y: 400, gate: true, r: 50 }],
    ];
    for (const pts of cases) {
      expect(feedLayout(pts, lim)).toEqual({ right: feedDockRight(pts, lim), top: null, cap: null, capAlways: false });
      expect(feedLayout(pts, { ...lim, preferRight: true })).toEqual({ right: feedDockRight(pts, { ...lim, preferRight: true }), top: null, cap: null, capAlways: false });
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Battle save wiring: the saver (src/ui/battle/battleSaver.js) and the payout (results.apply)
// ---------------------------------------------------------------------------------------------

/** Map-backed localStorage that records every write of the save key. */
function fakeStorage() {
  const m = new Map();
  const writes = [];
  return {
    m,
    writes,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      m.set(k, String(v));
      if (k === SAVE_KEY) writes.push(String(v));
    },
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

/** Just enough DOM for createResults() to build its (hidden) overlay in Node. */
class FakeNode {
  constructor() {
    this.children = [];
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
    this.style = { setProperty() {} };
    this.dataset = {};
  }
  setAttribute() {}
  addEventListener() {}
  appendChild(c) {
    this.children.push(c);
    return c;
  }
  append(...c) {
    this.children.push(...c);
  }
  remove() {}
}

/** A fresh profile in the store, a New game on 1-1 with its saver installed. */
function newGame(stageId = '1-1', { mode } = {}) {
  store.replace(createProfile());
  const req = { stageId, difficulty: 'normal', endless: false, ...(mode ? { mode } : {}) };
  const { sim, cfg } = createBattleSim(store.profile, { ...req, seed: 4242 });
  const ctx = { ended: false };
  const saver = createBattleSaver({ sim, req, cfg, isEnded: () => ctx.ended }).install();
  return { sim, saver, ctx, cfg };
}
const stored = (ls) => JSON.parse(ls.getItem(SAVE_KEY));
const spot = (sim, unitId) => {
  for (let y = 0.25; y < sim.map.height; y += 0.5) for (let x = 0.25; x < sim.map.width; x += 0.5) if (sim.canPlace(unitId, x, y).ok) return [x, y];
  return null;
};

describe('battle saver', () => {
  let ls;
  beforeEach(() => {
    ls = fakeStorage();
    vi.stubGlobal('localStorage', ls);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('writes nothing until the first progress; the first command creates the record at once', () => {
    const { sim, saver } = newGame();
    saver.flush();
    expect(saver.hasProgress).toBe(false);
    expect(store.profile.battleSaves).toEqual({});
    const unitId = [...sim.loadout.keys()][0];
    sim.placeTower(unitId, ...spot(sim, unitId));
    saver.markProgress();
    const rec = stored(ls).battleSaves['1-1'];
    expect(rec).toMatchObject({ id: saver.runId, slot: '1-1', stageId: '1-1', difficulty: 'normal', seed: 4242, resumes: 0 });
    expect(rec.snap).toMatchObject({ wave: 0, state: 'prep' });
    expect(rec.snap.towers.map((t) => t.u)).toEqual([unitId]);
    expect(rec.loadout.map((e) => e.unitId)).toEqual([...sim.loadout.keys()]);
    expect(rec.view).toEqual({ next: 1, of: sim.totalWaves, lives: sim.lives, difficulty: 'normal', mode: 'standard' });
    expect('mode' in rec).toBe(false); // Standard: no mode field (a record from before the modes reads the same)
  });

  it('a battle-mode run names its mode in the record, and Continue rebuilds the run in it', () => {
    const { sim, saver } = newGame('1-1', { mode: 'rush' });
    expect(sim.mode.id).toBe('rush');
    const unitId = [...sim.loadout.keys()][0];
    sim.placeTower(unitId, ...spot(sim, unitId));
    saver.markProgress();
    const rec = stored(ls).battleSaves['1-1'];
    expect(rec.mode).toBe('rush');
    expect(rec.view.mode).toBe('rush');
    const { sim: back } = resumeBattleSim(store.profile, rec);
    expect(back.mode.id).toBe('rush');
    expect(back.towers.map((t) => t.unitId)).toEqual([unitId]);
  });

  it('a wave start writes the calm state before it; mid-wave commands never overwrite it; between waves they do (batched)', () => {
    const { sim, saver } = newGame();
    const unitId = [...sim.loadout.keys()][0];
    sim.placeTower(unitId, ...spot(sim, unitId));
    saver.markProgress();
    expect(sim.startNextWave()).toBe(true);
    expect(saver.persistPending()).toBe(true);
    const atStart = stored(ls).battleSaves['1-1'].snap;
    expect(atStart).toMatchObject({ wave: 0, state: 'prep' });
    // mid-wave: a sale is undone by Continue (the wave-start snapshot stands)
    const t = sim.towers[0];
    sim.sellTower(t.uid);
    saver.markProgress();
    saver.flush();
    vi.advanceTimersByTime(500);
    expect(stored(ls).battleSaves['1-1'].snap).toEqual(atStart);
    for (let i = 0; i < 6000 && sim.state === 'wave'; i++) sim.update(1 / 30);
    expect(sim.state).toBe('between');
    // between waves: a fresh snapshot, written after the debounce
    sim.placeTower(unitId, ...spot(sim, unitId));
    saver.markProgress();
    expect(stored(ls).battleSaves['1-1'].snap.wave).toBe(0);
    vi.advanceTimersByTime(200);
    expect(stored(ls).battleSaves['1-1'].snap).toMatchObject({ wave: 1, state: 'between' });
    expect(stored(ls).battleSaves['1-1'].view.next).toBe(2);
  });

  it('every wave plays its own stream: hash(run seed, wave)', () => {
    const a = newGame();
    const b = newGame();
    a.sim.rng.next();
    a.sim.startNextWave();
    b.sim.startNextWave();
    expect(a.sim.rng.next()).toBe(b.sim.rng.next());
  });

  it('a closed or discarded saver never writes again, and never brings a deleted record back', () => {
    const { sim, saver } = newGame();
    const unitId = [...sim.loadout.keys()][0];
    sim.placeTower(unitId, ...spot(sim, unitId));
    saver.markProgress();
    const id = saver.runId;
    // another New game took the slot (here: the record was cleared under the saver)
    clearBattleSave(store.profile, '1-1', id);
    sim.upgradeTower(sim.towers[0].uid, 0);
    saver.markProgress();
    saver.flush();
    vi.advanceTimersByTime(500);
    expect(store.profile.battleSaves['1-1']).toBeUndefined();
    expect(saver.closed).toBe(true);
    // discard: Restart / Retry
    const g = newGame();
    g.sim.placeTower(unitId, ...spot(g.sim, unitId));
    g.saver.markProgress();
    expect(stored(ls).battleSaves['1-1']).toBeTruthy();
    g.saver.discard();
    expect(stored(ls).battleSaves['1-1']).toBeUndefined();
    g.sim.startNextWave();
    g.saver.persistPending();
    g.saver.flush();
    expect(stored(ls).battleSaves['1-1']).toBeUndefined();
  });

  it('a wave end is written once, with no command: a crash on the between-wave shop keeps the cleared wave', () => {
    const { sim, saver } = newGame();
    const unitId = [...sim.loadout.keys()][0];
    sim.placeTower(unitId, ...spot(sim, unitId));
    saver.markProgress();
    sim.startNextWave();
    saver.persistPending();
    const frame = () => {
      sim.update(1 / 30);
      saver.persistPending();
      saver.persistCalm();
    };
    for (let i = 0; i < 6000 && sim.state === 'wave'; i++) frame();
    expect(sim.state).toBe('between');
    const rec = stored(ls).battleSaves['1-1'];
    expect(rec.snap).toMatchObject({ state: 'between', wave: 1, wavesCleared: 1, cash: sim.cash });
    expect(rec.snap.kills).toEqual(sim.kills);
    expect(rec.view.next).toBe(2);
    // idling on the shop writes nothing more
    const writes = ls.writes.length;
    for (let i = 0; i < 300; i++) frame();
    vi.advanceTimersByTime(60000);
    expect(ls.writes.length).toBe(writes);
  });

  it('a batch of commands between waves is one write (one debounce, not the store\'s as well)', () => {
    const { sim, saver } = newGame();
    const unitId = [...sim.loadout.keys()][0];
    sim.placeTower(unitId, ...spot(sim, unitId));
    saver.markProgress();
    const writes = ls.writes.length;
    sim.setTargetMode(sim.towers[0].uid, 'strong');
    saver.markProgress();
    sim.upgradeTower(sim.towers[0].uid, 0);
    saver.markProgress();
    vi.advanceTimersByTime(1000);
    expect(ls.writes.length).toBe(writes + 1);
    expect(stored(ls).battleSaves['1-1'].snap.towers[0].tiers[0]).toBe(1);
  });

  it('saved battles full: nothing is replaced without the player\'s choice (evict), which is deleted on the first write', () => {
    store.replace(createProfile());
    const others = ['1-2', '1-3', '1-4', '1-5', '2-1'];
    for (const [i, id] of others.entries()) {
      const g = createBattleSim(store.profile, { stageId: id, difficulty: 'normal', seed: 10 + i });
      const sv = createBattleSaver({ sim: g.sim, req: { stageId: id }, cfg: g.cfg }).install();
      const u = [...g.sim.loadout.keys()][0];
      g.sim.placeTower(u, ...spot(g.sim, u));
      sv.markProgress();
    }
    expect(Object.keys(stored(ls).battleSaves).sort()).toEqual(others);
    const play = (evict) => {
      const { sim, cfg } = createBattleSim(store.profile, { stageId: '1-1', difficulty: 'normal', seed: 4242 });
      const full = vi.fn();
      const saver = createBattleSaver({ sim, req: { stageId: '1-1' }, cfg, evict, onFull: full }).install();
      const u = [...sim.loadout.keys()][0];
      sim.placeTower(u, ...spot(sim, u));
      saver.markProgress();
      sim.startNextWave();
      saver.persistPending();
      saver.flush();
      return { saver, full };
    };
    // a deep link with no choice: this battle is not saved, the player is told once, nothing goes
    const a = play(null);
    expect(a.full).toHaveBeenCalledTimes(1);
    expect(a.saver.full).toBe(true);
    expect(a.saver.hasProgress).toBe(false);
    expect(Object.keys(stored(ls).battleSaves).sort()).toEqual(others);
    // stage prep's choice (1-4): exactly that one goes, when this battle is first saved
    const chosen = store.profile.battleSaves['1-4'].id;
    const b = play(chosen);
    expect(b.full).not.toHaveBeenCalled();
    expect(b.saver.full).toBe(false);
    expect(Object.keys(stored(ls).battleSaves).sort()).toEqual(['1-1', '1-2', '1-3', '1-5', '2-1']);
  });

  it('a write that fails says why: storage full, or saving paused', () => {
    const { sim, saver: s0 } = newGame();
    s0.close();
    const told = [];
    const saver = createBattleSaver({ sim, req: { stageId: '1-1' }, onStorageFull: (reason) => { told.push(reason); return true; } }).install();
    ls.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const unitId = [...sim.loadout.keys()][0];
    sim.placeTower(unitId, ...spot(sim, unitId));
    saver.markProgress();
    saver.flush();
    expect(told).toEqual(['quota']); // once
    expect(store.lastSaveError).toBe('quota');
  });

  it('a finish clears only its own run (a newer run in the slot stays)', () => {
    const { sim, saver } = newGame();
    const unitId = [...sim.loadout.keys()][0];
    sim.placeTower(unitId, ...spot(sim, unitId));
    saver.markProgress();
    store.profile.battleSaves['1-1'] = { ...store.profile.battleSaves['1-1'], id: 'bs-newer' };
    expect(saver.finish(store.profile)).toBe(false);
    expect(store.profile.battleSaves['1-1'].id).toBe('bs-newer');
  });
});

describe('results.apply() with a battle save', () => {
  let ls;
  beforeEach(() => {
    ls = fakeStorage();
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('Node', FakeNode);
    vi.stubGlobal('document', { createElement: () => new FakeNode(), createTextNode: () => new FakeNode() });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** A New game on 1-1 that made progress (a girl placed, a wave started) and then lost. */
  function lostGame() {
    const g = newGame();
    const unitId = [...g.sim.loadout.keys()][0];
    g.sim.placeTower(unitId, ...spot(g.sim, unitId));
    g.saver.markProgress();
    g.sim.startNextWave();
    g.saver.persistPending();
    g.sim.lives = 1;
    for (let k = 0; k < 4000 && g.sim.state !== 'lost'; k++) {
      if (g.sim.state !== 'wave') g.sim.startNextWave();
      g.sim.update(0.25);
    }
    expect(g.sim.state).toBe('lost');
    expect(stored(ls).battleSaves['1-1']).toBeTruthy();
    g.ctx.ended = true;
    g.saver.close();
    return g;
  }

  it('pays and deletes the save in the same write; a second apply changes nothing', () => {
    const g = lostGame();
    const before = stored(ls);
    const results = createResults({ ...g.ctx, sim: g.sim, stage: STAGE_MAP['1-1'], layer: new FakeNode(), saver: g.saver });
    const writes = ls.writes.length;
    const out = results.apply();
    const after = stored(ls);
    // one synchronous write holds both: the result and no save
    expect(ls.writes.length).toBe(writes + 1);
    expect(after.battleSaves).toEqual({});
    expect(after.stats.battles).toBe(before.stats.battles + 1);
    const coins = out.rewards.find((r) => r.id === 'coins')?.count || 0;
    expect(coins).toBe(40 * g.sim.wavesCleared);
    expect(after.currencies.coins).toBe(before.currencies.coins + coins);
    // twice: nothing more
    expect(results.apply()).toBe(out);
    expect(stored(ls)).toEqual(after);
    expect(ls.writes.length).toBe(writes + 1);
  });

  it('an apply whose reward step throws still deletes the save', () => {
    const g = lostGame();
    const results = createResults({ ...g.ctx, sim: g.sim, stage: STAGE_MAP['1-1'], layer: new FakeNode(), saver: g.saver, applyResult: () => { throw new Error('boom'); } });
    const out = results.apply();
    expect(out.error).toBe(true);
    expect(stored(ls).battleSaves).toEqual({});
  });

  it('End run on an endless run pays exactly what a defeat at that moment pays (40 coins per wave held)', () => {
    store.replace(createProfile());
    store.profile.progress.stages['2-5'] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 }; // the Colosseum opens
    const req = { stageId: 'challenge', difficulty: 'normal', endless: true };
    const { sim, cfg } = createBattleSim(store.profile, { ...req, seed: 99 });
    const ctx = { ended: false };
    const saver = createBattleSaver({ sim, req, cfg, isEnded: () => ctx.ended }).install();
    expect(saver.slot).toBe('challenge');
    sim.cash = 1e6;
    const unitId = [...sim.loadout.keys()][0];
    sim.placeTower(unitId, ...spot(sim, unitId));
    for (const p of [0, 0, 1]) sim.upgradeTower(sim.towers[0].uid, p);
    saver.markProgress();
    for (let k = 0; k < 20000 && sim.wavesCleared < 3 && sim.state !== 'lost'; k++) {
      if (sim.state === 'prep' || sim.state === 'between') {
        sim.startNextWave();
        saver.persistPending();
      }
      sim.update(0.25);
    }
    expect(sim.state).toBe('between');
    expect(stored(ls).battleSaves.challenge.snap.wave).toBe(2);
    // End run: endBattle(false, { endedRun: true }) → saver.close() → results.apply()
    const before = stored(ls);
    ctx.ended = true;
    saver.close();
    const out = createResults({ ...ctx, endedRun: true, sim, stage: STAGE_MAP.challenge, layer: new FakeNode(), saver }).apply();
    const after = stored(ls);
    expect(out.rewards).toEqual([{ id: 'coins', count: 40 * sim.wavesCleared }]);
    expect(after.currencies.coins).toBe(before.currencies.coins + 40 * sim.wavesCleared);
    expect(after.progress.stages.challenge.bestWave).toBe(sim.wavesCleared);
    expect(after.battleSaves).toEqual({});
  });

  it('a saved run rolls its drops from the run seed (the same run finished twice rolls the same)', () => {
    const roll = () => {
      const g = newGame();
      const unitId = [...g.sim.loadout.keys()][0];
      g.sim.placeTower(unitId, ...spot(g.sim, unitId));
      g.saver.markProgress();
      // a won result, as the payout sees it
      g.sim.state = 'won';
      g.sim.wavesCleared = g.sim.totalWaves;
      g.ctx.ended = true;
      g.saver.close();
      return createResults({ ...g.ctx, sim: g.sim, stage: STAGE_MAP['1-1'], layer: new FakeNode(), saver: g.saver }).apply();
    };
    const a = roll();
    const b = roll();
    expect(a.firstClear).toBe(true);
    expect(a.rewards).toEqual(b.rewards);
    expect(a.gear.map((x) => [x.slot, x.rarity, x.main])).toEqual(b.gear.map((x) => [x.slot, x.rarity, x.main]));
  });
});

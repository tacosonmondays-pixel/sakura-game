// Tryout Day in the co-op room (docs/specs/TRYOUT_DAY.md §11, §14.4): the plausibility clamp of a run's
// start message (pool, draft, tryout; statLimits.js) and the room setting (session.js): the host's run
// rides in room / hello like freeplay, a changed run takes the guest's Ready back, each player's draft,
// pool and run hero ride in hello / ready, and the start message both clients build the run from.
import { describe, it, expect } from 'vitest';
import { openSession, LOBBY, tryoutSetting, sameTryout, draftReady, roomNote } from '../../src/online/coop/session.js';
import { clampStart, clampPlayer, clampPool, clampDraft, clampTryout, LOADOUT_MAX, UNIT_STAT_LIMITS } from '../../src/online/coop/statLimits.js';

// the co-op damage ceiling (10 before the banners release; 15 since UR Resonance and LR)
const DMG_MAX = UNIT_STAT_LIMITS.damageMul.hi;
import { TRYOUT_STUDENTS } from '../../src/data/tryout.js';
import { createProfile } from '../../src/systems/save.js';
import { frozenPool, draftOf } from '../../src/systems/tryoutRuns.js';
import { mapChoices, TRYOUT_GRADES } from '../../src/sim/tryout/plan.js';

// ---------------------------------------------------------------------------------------------
// A small fake room transport with simulated time (the pattern of coopSession.test.js)
// ---------------------------------------------------------------------------------------------
function world({ latency = 60 } = {}) {
  const clock = { t: 1_000_000 };
  const intervals = new Map();
  let nextId = 1;
  const timers = {
    setInterval: (fn, ms) => {
      const id = nextId++;
      intervals.set(id, { fn, ms, due: clock.t + ms });
      return id;
    },
    clearInterval: (id) => intervals.delete(id),
  };
  const wire = [];
  const rooms = [];
  const W = {
    clock,
    timers,
    lose: () => false,
    now: () => clock.t,
    backend(uid) {
      return {
        uid,
        openRoom(code, handlers) {
          const r = {
            uid, code, handlers, up: false, closed: false, log: [], status: 'connecting',
            net: { heartbeatMs: 250, inputDelay: 30, keepaliveMs: 1000 },
            get connected() {
              return r.up && !r.closed;
            },
            send(msg) {
              if (r.closed) return false;
              r.log.push({ at: clock.t, msg: JSON.parse(JSON.stringify(msg)), up: r.up });
              if (!r.up) return false;
              for (const to of rooms) {
                if (to === r || to.code !== r.code || to.closed || W.lose(msg)) continue;
                wire.push({ at: clock.t + latency, from: r, to, msg: JSON.parse(JSON.stringify(msg)) });
              }
              return true;
            },
            reconnect() {},
            close() {
              r.closed = true;
            },
          };
          rooms.push(r);
          return r;
        },
      };
    },
    connect(r) {
      r.up = true;
      r.status = 'connected';
      r.handlers.onStatus?.('connected', { rejoin: false });
    },
    step(ms) {
      const end = clock.t + ms;
      while (clock.t < end) {
        clock.t = Math.min(end, clock.t + 10);
        for (let i = 0; i < wire.length;) {
          const w = wire[i];
          if (w.at > clock.t) {
            i++;
            continue;
          }
          wire.splice(i, 1);
          if (w.to.up && !w.to.closed) w.to.handlers.onMessage(w.msg, w.from.uid);
        }
        for (const it of [...intervals.values()]) {
          if (it.due <= clock.t) {
            it.due += it.ms;
            it.fn();
          }
        }
      }
    },
    until(cond, max = 30000) {
      const t0 = clock.t;
      while (!cond() && clock.t - t0 < max) W.step(10);
      return cond() ? clock.t - t0 : null;
    },
  };
  return W;
}

const HOST = 'host-uid';
const GUEST = 'guest-uid';
const meOf = (uid, name, units) => ({ uid, name, level: 5, avatar: 'aoi', loadout: units.map((unitId) => ({ unitId, stats: { costMul: 0.9 } })), hero: null });

function open(W, isHost, extra = {}) {
  const uid = isHost ? HOST : GUEST;
  return openSession({
    code: 'TRY01', isHost, backend: W.backend(uid), timers: W.timers, now: W.now, exclusive: false, stageId: '1-2',
    me: meOf(uid, isHost ? 'Aiko' : 'Bea', isHost ? ['aoi', 'rei'] : ['yuki', 'rei']),
    ...extra,
  });
}
function paired(W, hostExtra = {}) {
  const host = open(W, true, hostExtra);
  const guest = open(W, false);
  W.connect(host.room);
  W.connect(guest.room);
  expect(W.until(() => host.paired && guest.paired)).not.toBe(null);
  return { host, guest };
}
const lastMsg = (s, type) => s.room.log.filter((e) => e.msg.type === type).at(-1)?.msg;

const POOL = frozenPool(createProfile());
const ownedIn = (pool) => (id) => Object.prototype.hasOwnProperty.call(pool, id);
/** A player's run picks for a seed: the first 3 of their own six, their pool, a free hero. */
function picksFor(seed, slot, hero = 'hikari') {
  return { draft: draftOf(ownedIn(POOL), seed, slot, 0).slice(0, 3), pool: POOL, runHero: { unitId: hero, stats: {} } };
}
function runOf(seed, pick = 0) {
  return { seed, grade: 1, length: 'half', mapId: mapChoices(seed, 1)[pick] };
}

// ---------------------------------------------------------------------------------------------
// statLimits.js
// ---------------------------------------------------------------------------------------------
describe('the clamp: a run\'s pool, draft and settings', () => {
  it('an honest frozen pool is the identity (ids, order, stats)', () => {
    expect(Object.keys(POOL).length).toBeGreaterThan(0);
    expect(clampPool(POOL)).toEqual(POOL);
    expect(Object.keys(clampPool(POOL))).toEqual(Object.keys(POOL));
  });

  it('the pool keeps only tryout students, clamps each entry, and is not capped at LOADOUT_MAX', () => {
    const big = {};
    for (const id of TRYOUT_STUDENTS) big[id] = { damageMul: 1000, rateMul: 1, potential: 9, bogus: 5 };
    const pool = { hikari: { damageMul: 2 }, tenka: {}, nobody: { damageMul: 1 }, toString: {}, ...big, aoi: null, rei: [1, 2], yuki: 'x' };
    const out = clampPool(pool);
    expect(Object.keys(out)).toEqual(TRYOUT_STUDENTS.filter((id) => !['aoi', 'rei', 'yuki'].includes(id)));
    expect(Object.keys(out).length).toBeGreaterThan(LOADOUT_MAX);
    expect(Object.keys(out).length).toBeLessThanOrEqual(29);
    for (const st of Object.values(out)) expect(st).toEqual({ damageMul: DMG_MAX, rateMul: 1, potential: 6 });
    for (const bad of [null, undefined, 5, 'aoi', ['aoi']]) expect(clampPool(bad)).toEqual({});
    expect(clampPool(out)).toEqual(out);
  });

  it('the draft is at most 3 distinct tryout students', () => {
    expect(clampDraft(['aoi', 'kage', 'yuki'])).toEqual(['aoi', 'kage', 'yuki']);
    expect(clampDraft(['aoi', 'aoi', 7, null, 'hikari', 'tenka', 'kage', 'yuki', 'rei'])).toEqual(['aoi', 'kage', 'yuki']);
    expect(clampDraft(['aoi'])).toEqual(['aoi']);
    for (const bad of [null, undefined, 'aoi', { 0: 'aoi' }]) expect(clampDraft(bad)).toEqual([]);
  });

  it('the run settings: seed uint32, grade 1–12, length half | full, mapId a string', () => {
    expect(clampTryout({ seed: 77, grade: 1, length: 'half', mapId: 'lake_shore' })).toEqual({ seed: 77, grade: 1, length: 'half', mapId: 'lake_shore' });
    expect(clampTryout({ seed: -1, grade: 0, length: 'full', mapId: 5, extra: 1 })).toEqual({ seed: 4294967295, grade: 1, length: 'full', mapId: null });
    expect(clampTryout({ seed: 2 ** 40 + 3, grade: 99, length: 'forever' })).toEqual({ seed: 3, grade: 12, length: 'half', mapId: null });
    expect(clampTryout({ seed: '12', grade: 3.7 })).toMatchObject({ seed: 0, grade: 3 });
    expect(clampTryout({ seed: Number.NaN, grade: Infinity })).toMatchObject({ seed: 0, grade: 1 });
    expect(clampTryout({ mapId: 'x'.repeat(500) }).mapId.length).toBe(64);
    for (const bad of [null, undefined, true, 5, 'run', []]) expect(clampTryout(bad)).toBe(null);
  });

  it('a run start: every player\'s pool and draft clamped, tryout sanitised; idempotent', () => {
    const raw = {
      v: 1, seed: 9, stageId: 'tryout', difficulty: 'normal', freeplay: null, mode: 'standard',
      tryout: { seed: -5, grade: 40, length: 'full', mapId: 'lake_shore', tableVersion: 3 },
      players: [
        { slot: 0, uid: 'a', name: 'A', loadout: [], hero: { unitId: 'hikari', stats: { damageMul: 99 } }, draft: ['aoi', 'aoi', 'kage', 'zzz', 'yuki', 'rei'], pool: { aoi: { damageMul: 50 }, hikari: { damageMul: 1 } } },
        { slot: 1, uid: 'b', name: 'B', loadout: [], hero: null, draft: 'aoi', pool: 'nope' },
      ],
    };
    const once = clampStart(raw);
    expect(once.tryout).toEqual({ seed: 4294967291, grade: 12, length: 'full', mapId: 'lake_shore' });
    expect(once.players[0].draft).toEqual(['aoi', 'kage', 'yuki']);
    expect(once.players[0].pool).toEqual({ aoi: { damageMul: DMG_MAX } });
    expect(once.players[0].hero.stats.damageMul).toBe(DMG_MAX);
    expect(once.players[1].draft).toEqual([]);
    expect(once.players[1].pool).toEqual({});
    expect(clampStart(once)).toEqual(once);
    expect(clampStart(JSON.parse(JSON.stringify(once)))).toEqual(once);
    // a garbage tryout stays a key (null: no run), still idempotent
    const off = clampStart({ ...raw, tryout: 'yes' });
    expect(off.tryout).toBe(null);
    expect(clampStart(off)).toEqual(off);
  });

  it('a normal start is unchanged: no pool, draft or tryout keys appear', () => {
    const start = {
      v: 1, seed: 3, stageId: '1-2', difficulty: 'normal', freeplay: null, mode: 'standard',
      players: [
        { slot: 0, uid: 'a', name: 'A', loadout: [{ unitId: 'aoi', stats: { damageMul: 1.2 } }], hero: { unitId: 'hikari', stats: { damageMul: 1.1 } }, color: '#f00' },
        { slot: 1, uid: 'b', name: 'B', loadout: [{ unitId: 'rei', stats: { rateMul: 1.1 } }], hero: null, color: '#00f' },
      ],
    };
    const out = clampStart(start);
    expect(out).toEqual(start);
    expect('tryout' in out).toBe(false);
    for (const p of out.players) {
      expect('pool' in p).toBe(false);
      expect('draft' in p).toBe(false);
    }
    expect(Object.keys(clampPlayer(start.players[0]))).toEqual(Object.keys(start.players[0]));
  });
});

// ---------------------------------------------------------------------------------------------
// session.js
// ---------------------------------------------------------------------------------------------
describe('the room\'s Tryout Day setting', () => {
  it('tryoutSetting: Grade 1 Half Day on one of the seed\'s two maps; sameTryout; draftReady', () => {
    const [a, b] = mapChoices(42, 1);
    expect(tryoutSetting({ seed: 42, mapId: b, grade: 1, length: 'full' })).toEqual({ seed: 42, grade: 1, length: 'full', mapId: b });
    expect(tryoutSetting({ seed: 42, mapId: b, grade: 1, length: 'forever' }).length).toBe('half');
    // the host's Grade rides along, up to the Grades this build plays
    expect(tryoutSetting({ seed: 42, mapId: b, grade: 9 }).grade).toBe(9);
    expect(tryoutSetting({ seed: 42, mapId: b, grade: 15 }).grade).toBe(TRYOUT_GRADES);
    expect(tryoutSetting({ seed: 42, mapId: 'nowhere' }).mapId).toBe(a);
    expect(tryoutSetting(null)).toBe(null);
    expect(sameTryout(null, undefined)).toBe(true);
    expect(sameTryout(tryoutSetting(runOf(42)), null)).toBe(false);
    expect(sameTryout(tryoutSetting(runOf(42)), tryoutSetting(runOf(42)))).toBe(true);
    expect(draftReady(['aoi', 'kage', 'yuki'])).toBe(true);
    expect(draftReady(['aoi', 'kage'])).toBe(false);
    expect(draftReady(['aoi', 'aoi', 'kage'])).toBe(false);
    expect(draftReady(['aoi', 'kage', 'hikari'])).toBe(false);
  });

  it('a normal room says nothing about runs: hello, room and ready carry no tryout, draft or pool', () => {
    const W = world();
    const { host, guest } = paired(W);
    // even with picks set (a run turned off later), nothing of them travels
    host.setRunPicks(picksFor(1, 0));
    guest.setRunPicks(picksFor(1, 1));
    guest.setReady(true);
    expect(W.until(() => host.canStart, 3000)).not.toBe(null);
    host.setStage('1-3', 'normal');
    W.step(LOBBY.keepaliveMs + 500);
    expect(Object.keys(lastMsg(host, 'hello').room)).toEqual(['stageId', 'difficulty', 'freeplay', 'mode']);
    expect(Object.keys(lastMsg(host, 'room'))).toEqual(['type', 'stageId', 'difficulty', 'freeplay', 'mode']);
    expect(Object.keys(lastMsg(guest, 'ready'))).toEqual(['type', 'uid', 'ready', 'freeplay', 'mode']);
    for (const s of [host, guest]) {
      const p = lastMsg(s, 'hello').player;
      expect('draft' in p || 'pool' in p || 'runHero' in p).toBe(false);
      expect('tryout' in lastMsg(s, 'hello')).toBe(false);
    }
    expect(host.startBattle(5)).toBe(true);
    expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
    expect('tryout' in host.lockstep.start).toBe(false);
    expect(host.lockstep.start.stageId).toBe('1-3');
    expect(host.lockstep.start.players.map((p) => Object.keys(p))).toEqual([
      ['slot', 'uid', 'name', 'loadout', 'hero', 'color'],
      ['slot', 'uid', 'name', 'loadout', 'hero', 'color'],
    ]);
    host.close();
    guest.close();
  });

  it('the run rides in hello and room; Start needs the guest\'s Ready for this run and both drafts of 3; both build the run', () => {
    const W = world();
    const run = runOf(4242, 1);
    const { host, guest } = paired(W, { tryout: run });
    expect(host.tryout).toEqual(run);
    expect(guest.tryout).toEqual(run); // from the host's hello
    expect(lastMsg(host, 'hello').room.tryout).toEqual(run);
    // Ready without drafts: no Start
    guest.setReady(true);
    W.step(500);
    expect(host.peer.ready).toBe(true);
    expect(host.canStart).toBe(false);
    host.setRunPicks(picksFor(run.seed, 0));
    W.step(300);
    expect(host.canStart).toBe(false); // the guest has not drafted yet
    const gp = picksFor(run.seed, 1, 'nami');
    guest.setRunPicks({ draft: gp.draft.slice(0, 2), pool: gp.pool, runHero: gp.runHero });
    W.step(300);
    expect(host.peer.draft).toEqual(gp.draft.slice(0, 2));
    expect(host.canStart).toBe(false); // 2 of 3
    guest.setRunPicks({ draft: gp.draft });
    expect(W.until(() => host.canStart, 3000)).not.toBe(null);
    const ready = lastMsg(guest, 'ready');
    expect(ready).toMatchObject({ ready: true, tryout: run, draft: gp.draft, runHero: { unitId: 'nami', stats: {} } });
    expect(Object.keys(ready.pool)).toEqual(Object.keys(POOL));
    expect(lastMsg(guest, 'hello').tryout).toEqual(run);
    expect(host.startBattle(31)).toBe(true);
    expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
    const start = host.lockstep.start;
    expect(guest.lockstep.start).toEqual(start);
    expect(start).toMatchObject({ seed: 31, stageId: 'tryout', difficulty: 'normal', freeplay: null, mode: 'standard', tryout: run });
    expect(start.players.map((p) => p.draft)).toEqual([picksFor(run.seed, 0).draft, gp.draft]);
    expect(start.players.map((p) => p.hero)).toEqual([{ unitId: 'hikari', stats: {} }, { unitId: 'nami', stats: {} }]);
    expect(start.players.map((p) => p.loadout)).toEqual([[], []]);
    expect(start.players[1].pool).toEqual(POOL);
    for (const s of [host, guest]) {
      expect(s.lockstep.sim.tryout).toBeTruthy();
      expect(s.lockstep.sim.tryout.players.map((p) => p.squad)).toEqual(start.players.map((p) => p.draft));
      // the room keeps its own stage (the run's stageId is 'tryout')
      expect(s.stageId).toBe('1-2');
      expect(s.tryout).toEqual(run);
    }
    // back to the room: a run is played once, so the host's room has a fresh seed at the same Grade, drafts cleared
    expect(host.backToLobby()).toBe(true);
    expect(host.tryout.seed).not.toBe(run.seed);
    expect(host.tryout.grade).toBe(run.grade);
    expect(mapChoices(host.tryout.seed, host.tryout.grade)).toContain(host.tryout.mapId);
    expect(host.me.draft).toEqual([]);
    host.close();
    guest.close();
  });

  it('Ready is consent: a changed run takes the guest\'s Ready back; a new seed clears both drafts; off is a normal room again', () => {
    const W = world();
    const run = runOf(7);
    const { host, guest } = paired(W, { tryout: run });
    host.setRunPicks(picksFor(7, 0));
    guest.setRunPicks(picksFor(7, 1));
    guest.setReady(true);
    expect(W.until(() => host.canStart, 3000)).not.toBe(null);
    // the other map of the same seed: Start locks at once, the guest's Ready goes, drafts stay
    const other = runOf(7, 1);
    host.setTryout(other);
    expect(host.canStart).toBe(false);
    expect(host.startBattle(1)).toBe(false);
    W.step(500);
    expect(guest.tryout).toEqual(other);
    expect(guest.me.ready).toBe(false);
    expect(host.peer.ready).toBe(false);
    expect(guest.me.draft).toEqual(picksFor(7, 1).draft);
    // a stale Ready (lost room message: the guest still says ready for the old map) never counts
    guest.setReady(true);
    expect(W.until(() => host.canStart, 3000)).not.toBe(null);
    W.lose = (msg) => msg.type === 'room';
    host.setTryout(run);
    let startable = false;
    expect(W.until(() => {
      startable ||= host.canStart;
      return sameTryout(guest.tryout, run);
    }, LOBBY.keepaliveMs * 2)).not.toBe(null);
    expect(startable).toBe(false);
    expect(guest.me.ready).toBe(false);
    W.lose = () => false;
    // a new seed: another six each, so both drafts go
    host.setTryout(runOf(8));
    W.step(500);
    expect(guest.tryout.seed).toBe(8);
    expect(host.me.draft).toEqual([]);
    expect(guest.me.draft).toEqual([]);
    // off: a normal room again (the guest's Ready for "off" starts a stage battle)
    host.setTryout(null);
    W.step(500);
    expect(guest.tryout).toBe(null);
    guest.setReady(true);
    expect(W.until(() => host.canStart, 3000)).not.toBe(null);
    expect('tryout' in lastMsg(host, 'room')).toBe(false);
    expect(host.startBattle(2)).toBe(true);
    expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
    expect(guest.lockstep.start.stageId).toBe('1-2');
    expect(guest.lockstep.sim.tryout).toBeFalsy();
    host.close();
    guest.close();
  });

  it('Extended Day (§20.7): the room carries length after, a guest adopts it, and the host\'s ladder gates it', () => {
    const [m] = mapChoices(9, 1);
    expect(clampTryout({ seed: 9, grade: 1, length: 'after', mapId: m }).length).toBe('after');
    expect(tryoutSetting({ seed: 9, grade: 1, length: 'after', mapId: m }).length).toBe('after');
    expect(tryoutSetting({ seed: 9, grade: 1, length: 'after', mapId: m }, false).length).toBe('full');
    expect(tryoutSetting({ seed: 9, grade: 1, length: 'toString', mapId: m }).length).toBe('half');
    expect(sameTryout(tryoutSetting({ ...runOf(9), length: 'after' }), tryoutSetting({ ...runOf(9), length: 'full' }))).toBe(false);
    const W = world();
    const { host, guest } = paired(W);
    host.setTryout({ ...runOf(9), length: 'after' });
    W.step(300);
    expect(host.tryout.length).toBe('after');
    expect(guest.tryout).toEqual(host.tryout);
    host.close();
    guest.close();
    // a host without a Full Day cleared: the same request plays a Full Day
    const W2 = world();
    const locked = paired(W2, { afterUnlocked: () => false, tryout: { ...runOf(10), length: 'after' } });
    expect(locked.host.tryout.length).toBe('full');
    locked.host.setTryout({ ...runOf(11), length: 'after' });
    W2.step(300);
    expect(locked.host.tryout.length).toBe('full');
    expect(locked.guest.tryout.length).toBe('full');
    locked.host.close();
    locked.guest.close();
  });

  it('only the host sets the run; a guest\'s setTryout does nothing', () => {
    const W = world();
    const { host, guest } = paired(W);
    guest.setTryout(runOf(3));
    W.step(300);
    expect(guest.tryout).toBe(null);
    expect(host.tryout).toBe(null);
    host.close();
    guest.close();
  });
});


// ---------------------------------------------------------------------------------------------
// The Subject suggestion (§11): a room note outside lockstep
// ---------------------------------------------------------------------------------------------
describe('room notes: the partner\'s Subject suggestion', () => {
  it('roomNote keeps only known kinds and their fields', () => {
    expect(roomNote({ kind: 'subject', period: 3, k: 1, extra: 'x' })).toEqual({ kind: 'subject', period: 3, k: 1 });
    expect(roomNote({ kind: 'subject', period: 3, k: 2 })).toBe(null);
    expect(roomNote({ kind: 'subject', period: 0, k: 0 })).toBe(null);
    expect(roomNote({ kind: 'subject', period: 2.5, k: 0 })).toBe(null);
    expect(roomNote({ kind: 'toString', period: 2, k: 0 })).toBe(null);
    expect(roomNote(null)).toBe(null);
    expect(roomNote('subject')).toBe(null);
  });

  it('goes to the ally during the battle as a room message, never as a lockstep command', () => {
    const W = world();
    const { host, guest } = paired(W);
    // in the lobby there is nothing to suggest: nothing is sent
    expect(guest.sendNote({ kind: 'subject', period: 2, k: 1 })).toBe(false);
    expect(guest.room.log.some((e) => e.msg.type === 'note')).toBe(false);
    guest.setReady(true);
    expect(W.until(() => host.canStart, 3000)).not.toBe(null);
    expect(host.startBattle(7)).toBe(true);
    expect(W.until(() => guest.phase === 'battle', 5000)).not.toBe(null);
    const got = [];
    host.on('note', (n) => got.push(n));
    const before = { host: [...host.lockstep.pending.values()].flat().length, guest: [...guest.lockstep.pending.values()].flat().length };
    expect(guest.sendNote({ kind: 'subject', period: 2, k: 1 })).toBe(true);
    expect(guest.sendNote({ kind: 'subject', period: 2, k: 5 })).toBe(false); // not a note
    W.step(500);
    expect(got).toEqual([{ kind: 'subject', period: 2, k: 1 }]);
    expect(lastMsg(guest, 'note')).toEqual({ type: 'note', uid: GUEST, note: { kind: 'subject', period: 2, k: 1 } });
    // outside lockstep: no command queued on either side
    expect([...host.lockstep.pending.values()].flat().length).toBe(before.host);
    expect([...guest.lockstep.pending.values()].flat().length).toBe(before.guest);
    // a note claiming another player, or a junk note, is dropped
    host.room.handlers.onMessage({ type: 'note', uid: 'someone-else', note: { kind: 'subject', period: 2, k: 0 } }, 'someone-else');
    host.room.handlers.onMessage({ type: 'note', uid: GUEST, note: { kind: 'subject', period: 2, k: 0 } }, 'someone-else');
    host.room.handlers.onMessage({ type: 'note', uid: GUEST, note: { kind: 'subject', period: 'x', k: 0 } }, GUEST);
    expect(got).toHaveLength(1);
    host.close();
    guest.close();
  });
});

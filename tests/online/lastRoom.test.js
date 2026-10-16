// "Your last room" on the co-op menu (src/online/coop/lastRoom.js): what is remembered, for whom,
// for how long, what forgets it, and where Rejoin goes.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rememberRoom, lastRoom, roomByCode, forgetRoom, roomRoute } from '../../src/online/coop/lastRoom.js';

const session = (uid, code, isHost, stageId = '1-1', difficulty = 'normal') => ({ me: { uid }, code, isHost, stageId, difficulty });

describe('co-op: your last room', () => {
  beforeEach(() => {
    const m = new Map();
    vi.stubGlobal('localStorage', { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('remembers the room for two hours, then lets it go', () => {
    const t = 1_000_000;
    rememberRoom(session('aiko', 'AB3CD', true, '1-2', 'hard'), t);
    expect(lastRoom('aiko', t + 60000)).toEqual({ code: 'AB3CD', host: true, stageId: '1-2', difficulty: 'hard', freeplay: null, mode: 'standard', at: t });
    expect(lastRoom('aiko', t + 2 * 3600000 - 1)).not.toBe(null);
    expect(lastRoom('aiko', t + 2 * 3600000)).toBe(null);
  });

  it('keeps one room per player (two tabs of one browser are two players in local test mode)', () => {
    rememberRoom(session('aiko', 'AB3CD', true));
    rememberRoom(session('bea', 'AB3CD', false));
    expect(lastRoom('aiko')).toMatchObject({ code: 'AB3CD', host: true });
    expect(lastRoom('bea')).toMatchObject({ code: 'AB3CD', host: false });
    expect(lastRoom('chi')).toBe(null);
    // a page that does not know its player yet (a reloaded battle) finds the room by its code
    expect(roomByCode('AB3CD')?.code).toBe('AB3CD');
    expect(roomByCode('XQ7RT')).toBe(null);
  });

  it('forgetting another code (or for another player) leaves the last room alone', () => {
    rememberRoom(session('bea', 'AB3CD', false));
    forgetRoom('XQ7RT', 'bea'); // a mistyped code that was refused
    forgetRoom('AB3CD', 'aiko'); // someone else's
    expect(lastRoom('bea')?.code).toBe('AB3CD');
    forgetRoom('AB3CD', 'bea'); // that room is gone
    expect(lastRoom('bea')).toBe(null);
  });

  it('Rejoin: the host opens its room again with its stage, a guest joins by code', () => {
    expect(roomRoute({ code: 'AB3CD', host: true, stageId: '1-2', difficulty: 'hard' })).toEqual({ id: 'AB3CD', host: '1', stage: '1-2', difficulty: 'hard' });
    expect(roomRoute({ code: 'AB3CD', host: false, stageId: '1-2', difficulty: 'hard' })).toEqual({ id: 'AB3CD' });
  });

  it('a freeplay room is remembered with its setting: the host reopens it as one, a guest just joins (and takes the host\'s)', () => {
    const t = 1_000_000;
    rememberRoom({ ...session('aiko', 'AB3CD', true, '1-2', 'hard'), freeplay: 'crimson' }, t);
    rememberRoom({ ...session('bea', 'AB3CD', false, '1-2', 'hard'), freeplay: 'crimson' }, t);
    expect(lastRoom('aiko', t)).toMatchObject({ code: 'AB3CD', freeplay: 'crimson' });
    expect(roomRoute(lastRoom('aiko', t))).toEqual({ id: 'AB3CD', host: '1', stage: '1-2', difficulty: 'hard', freeplay: 'crimson' });
    expect(roomRoute(lastRoom('bea', t))).toEqual({ id: 'AB3CD' });
    // a room from before freeplay (no field) reopens as a normal one
    expect(roomRoute({ code: 'AB3CD', host: true, stageId: '1-2', difficulty: 'hard' })).not.toHaveProperty('freeplay');
  });

  it('without storage (private mode, blocked) it remembers nothing and never throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } });
    expect(() => rememberRoom(session('aiko', 'AB3CD', true))).not.toThrow();
    expect(lastRoom('aiko')).toBe(null);
    expect(() => forgetRoom('AB3CD', 'aiko')).not.toThrow();
  });
});

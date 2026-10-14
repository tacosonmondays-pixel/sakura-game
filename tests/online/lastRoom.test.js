// "Your last room" on the co-op menu (src/online/coop/lastRoom.js): what is remembered, for how
// long, what forgets it, and where Rejoin goes.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rememberRoom, lastRoom, forgetRoom, roomRoute } from '../../src/online/coop/lastRoom.js';

describe('co-op: your last room', () => {
  beforeEach(() => {
    const m = new Map();
    vi.stubGlobal('localStorage', { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('remembers the room for two hours, then lets it go', () => {
    const t = 1_000_000;
    rememberRoom({ code: 'AB3CD', isHost: true, stageId: '1-2', difficulty: 'hard' }, t);
    expect(lastRoom(t + 60000)).toEqual({ code: 'AB3CD', host: true, stageId: '1-2', difficulty: 'hard', at: t });
    expect(lastRoom(t + 2 * 3600000 - 1)).not.toBe(null);
    expect(lastRoom(t + 2 * 3600000)).toBe(null);
  });

  it('forgetting another code leaves the last room alone', () => {
    rememberRoom({ code: 'AB3CD', isHost: false, stageId: '1-1', difficulty: 'normal' });
    forgetRoom('XQ7RT'); // a mistyped code that was refused
    expect(lastRoom()?.code).toBe('AB3CD');
    forgetRoom('AB3CD'); // that room is gone
    expect(lastRoom()).toBe(null);
  });

  it('Rejoin: the host opens its room again with its stage, a guest joins by code', () => {
    expect(roomRoute({ code: 'AB3CD', host: true, stageId: '1-2', difficulty: 'hard' })).toEqual({ id: 'AB3CD', host: '1', stage: '1-2', difficulty: 'hard' });
    expect(roomRoute({ code: 'AB3CD', host: false, stageId: '1-2', difficulty: 'hard' })).toEqual({ id: 'AB3CD' });
  });

  it('without storage (private mode, blocked) it remembers nothing and never throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } });
    expect(() => rememberRoom({ code: 'AB3CD', isHost: true })).not.toThrow();
    expect(lastRoom()).toBe(null);
    expect(() => forgetRoom('AB3CD')).not.toThrow();
  });
});

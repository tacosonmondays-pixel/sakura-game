// Which Lockstep a #/battle route runs. Regression: solo battles (no ?coop, no session) once got
// `undefined === undefined` → read `.lockstep` of null and crashed every single-player battle.
import { describe, it, expect } from 'vitest';
import { battleLockstep } from '../../src/online/coop/session.js';

describe('battleLockstep', () => {
  const ls = { tick: 0 };
  const session = { code: 'ABCDE', lockstep: ls };

  it('solo battles never get a lockstep (with or without a co-op session around)', () => {
    expect(battleLockstep({ stage: '1-1', difficulty: 'easy' }, null)).toBe(null);
    expect(battleLockstep({ stage: '1-1' }, session)).toBe(null);
    expect(battleLockstep({}, undefined)).toBe(null);
    expect(battleLockstep(undefined, null)).toBe(null);
  });

  it('a co-op route runs its own room\'s lockstep only', () => {
    expect(battleLockstep({ coop: 'ABCDE' }, session)).toBe(ls);
    expect(battleLockstep({ coop: 'ZZZZZ' }, session)).toBe(null); // another room (stale link)
    expect(battleLockstep({ coop: 'ABCDE' }, null)).toBe(null); // reloaded page: no session
    expect(battleLockstep({ coop: 'ABCDE' }, { code: 'ABCDE', lockstep: null })).toBe(null); // still in the lobby
  });
});

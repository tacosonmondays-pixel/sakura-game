import { describe, it, expect } from 'vitest';
import { RULES, createLimiter, verdict, formatRetry } from '../../src/online/limits.js';

describe('rate limiter', () => {
  it('enforces the 2 s gap between chat messages and reports retryMs', () => {
    let t = 1000;
    const lim = createLimiter(RULES, () => t);
    expect(lim.hit('chat').ok).toBe(true);
    t += 600;
    const v = lim.hit('chat');
    expect(v.ok).toBe(false);
    expect(v.retryMs).toBe(1400);
    t += 1400;
    expect(lim.hit('chat').ok).toBe(true);
  });

  it('caps chat at 20 per minute (sliding window)', () => {
    let t = 0;
    const lim = createLimiter(RULES, () => t);
    for (let i = 0; i < 20; i++) {
      expect(lim.hit('chat').ok).toBe(true);
      t += 2000;
    }
    // t = 40 s: 20 messages inside the last minute
    const v = lim.hit('chat');
    expect(v.ok).toBe(false);
    expect(v.retryMs).toBe(20000); // the first one (t=0) leaves the window at 60 s
    t = 60000;
    expect(lim.hit('chat').ok).toBe(true);
  });

  it('check() does not record and undo() forgets the last hit', () => {
    let t = 0;
    const lim = createLimiter(RULES, () => t);
    expect(lim.check('chat').ok).toBe(true);
    expect(lim.check('chat').ok).toBe(true);
    lim.hit('chat');
    expect(lim.check('chat').ok).toBe(false);
    lim.undo('chat');
    expect(lim.check('chat').ok).toBe(true);
  });

  it('clan creation: 1 per 10 min and 3 per day', () => {
    const r = RULES.clan_create;
    expect(verdict(r, [0], 5 * 60000).retryMs).toBe(5 * 60000);
    expect(verdict(r, [0, 3600000, 7200000], 7300000).ok).toBe(false);
    expect(verdict(r, [0, 3600000, 7200000], 86400000).ok).toBe(true);
  });

  it('unknown actions are never limited and retry text is short', () => {
    expect(verdict(undefined, [1, 2, 3], 4).ok).toBe(true);
    expect(formatRetry(1400)).toBe('1.4 s');
    expect(formatRetry(30000)).toBe('30 s');
    expect(formatRetry(5 * 60000)).toBe('5 min');
  });
});

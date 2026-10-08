// SFX voice limiter (src/audio/limiter.js): gaps, per-sound voices, global/UI caps, priority stealing,
// game-speed scaling, per-frame aggregation.
import { describe, test, expect } from 'vitest';
import { createLimiter, capFrame, spamFamily, SPAM_BUDGET, BUDGET_BURST } from '../../src/audio/limiter.js';

const def = (o = {}) => ({ bus: 'battle', priority: 1, voices: 2, gap_ms: 0, ...o });

describe('createLimiter', () => {
  test('minimum retrigger gap per sound', () => {
    const L = createLimiter();
    expect(L.admit('ui.click', def({ bus: 'ui', gap_ms: 25 }), 0, 0.03).ok).toBe(true);
    expect(L.admit('ui.click', def({ bus: 'ui', gap_ms: 25 }), 0.01, 0.03)).toMatchObject({ ok: false, reason: 'gap' });
    expect(L.admit('ui.click', def({ bus: 'ui', gap_ms: 25 }), 0.026, 0.03).ok).toBe(true);
    expect(L.admit('ui.tab', def({ bus: 'ui', gap_ms: 25 }), 0.027, 0.03).ok).toBe(true);   // gaps are per id
  });
  test('per-sound voice cap replaces the oldest copy', () => {
    const L = createLimiter();
    const a = L.admit('fire.arrow', def({ voices: 2 }), 0, 1);
    L.admit('fire.arrow', def({ voices: 2 }), 0.1, 1);
    const c = L.admit('fire.arrow', def({ voices: 2 }), 0.2, 1);
    expect(c.ok).toBe(true);
    expect(c.steal).toBe(a.voice);
    expect(L.voices.filter((v) => v.id === 'fire.arrow')).toHaveLength(2);
  });
  test('global cap: lower priority voices are stolen, equal or higher are not', () => {
    const L = createLimiter({ cap: 3, uiCap: 2 });
    for (let i = 0; i < 3; i++) expect(L.admit(`hit.${i}`, def({ priority: 0, voices: 5 }), i * 0.01, 1).ok).toBe(true);
    expect(L.admit('hit.x', def({ priority: 0, voices: 5 }), 0.05, 1)).toMatchObject({ ok: false, reason: 'cap' });
    const leak = L.admit('bt.leak', def({ priority: 3 }), 0.06, 1);
    expect(leak.ok).toBe(true);
    expect(leak.steal.id).toBe('hit.0');                // the oldest lowest-priority voice
  });
  test('the UI keeps its own budget while battle is saturated', () => {
    const L = createLimiter({ cap: 2, uiCap: 2 });
    L.admit('a', def({ voices: 9 }), 0, 1);
    L.admit('b', def({ voices: 9 }), 0, 1);
    expect(L.admit('c', def({ voices: 9 }), 0, 1).ok).toBe(false);
    expect(L.admit('ui.click', def({ bus: 'ui' }), 0, 1).ok).toBe(true);
  });
  test('finished voices free their slot', () => {
    const L = createLimiter({ cap: 1 });
    L.admit('a', def(), 0, 0.1);
    expect(L.admit('b', def(), 0.05, 0.1).ok).toBe(false);
    expect(L.admit('b', def(), 0.2, 0.1).ok).toBe(true);
  });
  test('at 3× the gaps of spammy sounds stretch by √3, UI gaps do not', () => {
    const L = createLimiter();
    L.setSpeed(3);
    L.admit('fire.arrow', def({ gap_ms: 45, voices: 9 }), 0, 0.1);
    expect(L.admit('fire.arrow', def({ gap_ms: 45, voices: 9 }), 0.06, 0.1).ok).toBe(false);   // 45 ms × 1.73 = 78 ms
    expect(L.admit('fire.arrow', def({ gap_ms: 45, voices: 9 }), 0.08, 0.1).ok).toBe(true);
    L.admit('ui.click', def({ bus: 'ui', gap_ms: 25 }), 0, 0.03);
    expect(L.admit('ui.click', def({ bus: 'ui', gap_ms: 25 }), 0.026, 0.03).ok).toBe(true);
  });
  test('3× late-wave stress: about 20 fire+hit sounds per second get through', () => {
    const L = createLimiter({ cap: 14, uiCap: 6 });
    L.setSpeed(3);
    let played = 0;
    const ids = ['fire.arrow', 'fire.bullet', 'fire.magic', 'hit.pierce', 'hit.slash'];
    for (let f = 0; f < 60; f++) {                       // one second at 60 fps, 3 attacks + 3 hits per frame offered
      const t = f / 60;
      const frame = capFrame([...ids.map((id) => ({ id, cat: id.startsWith('fire') ? 'fire' : 'hit', key: id, score: 1 }))]);
      for (const s of frame) if (L.admit(s.id, def({ gap_ms: 45, voices: 3, priority: 0 }), t, 0.1).ok) played++;
    }
    expect(played).toBeGreaterThan(10);
    expect(played).toBeLessThanOrEqual(SPAM_BUDGET.attack + SPAM_BUDGET.hit + 2 * BUDGET_BURST);
  });
  test('spam budget: a family plays a burst, then SPAM_BUDGET per real second, at any game speed', () => {
    for (const speed of [1, 3]) {
      const L = createLimiter();
      L.setSpeed(speed);
      let n = 0;
      // 300 hits of 50 different kinds offered over 2 s (distinct ids, so per-sound gaps never block)
      for (let i = 0; i < 300; i++) if (L.admit(`hit.k${i % 50}`, def({ voices: 99, priority: 0 }), i / 150, 0.01).ok) n++;
      expect(n).toBeGreaterThanOrEqual(2 * SPAM_BUDGET.hit);
      expect(n).toBeLessThanOrEqual(2 * SPAM_BUDGET.hit + BUDGET_BURST + 1);
    }
  });
  test('budgets are per family and leave UI, player actions and flow alone', () => {
    expect(['fire.arrow', 'atk.beam', 'hit.crit', 'en.death', 'en.deathBig', 'st.burn', 'boom.big'].map(spamFamily))
      .toEqual(['attack', 'attack', 'hit', 'death', 'death', 'status', 'boom']);
    for (const id of ['ui.click', 'bt.place', 'bt.leak', 'en.bossDeath', 'en.bossPhase', 'hero.ult', 'gacha.flipSSR']) expect(spamFamily(id)).toBe(null);
    const L = createLimiter({ cap: 99 });
    let hits = 0;
    let fires = 0;
    let leaks = 0;
    for (let i = 0; i < 60; i++) {
      const t = i / 60;
      if (L.admit(`hit.k${i}`, def({ voices: 99 }), t, 0.01).ok) hits++;
      if (L.admit(`fire.k${i}`, def({ voices: 99 }), t, 0.01).ok) fires++;
      if (L.admit(`bt.leak${i}`, def({ voices: 99 }), t, 0.01).ok) leaks++;
    }
    expect(hits).toBeLessThanOrEqual(SPAM_BUDGET.hit + BUDGET_BURST);
    expect(fires).toBeLessThanOrEqual(SPAM_BUDGET.attack + BUDGET_BURST);
    expect(fires).toBeGreaterThan(hits);                 // separate buckets
    expect(leaks).toBe(60);
  });
  test('a refused sound spends no budget', () => {
    const L = createLimiter({ cap: 1 });
    const leak = L.admit('bt.leak', def({ priority: 3 }), 0, 10);
    for (let i = 0; i < 10; i++) expect(L.admit(`hit.k${i}`, def({ priority: 0 }), 0, 0.1)).toMatchObject({ ok: false, reason: 'cap' });
    L.release(leak.voice);
    // voices last at least 5 ms, so 6 ms apart each one finds the single slot free again
    for (let i = 0; i < BUDGET_BURST; i++) expect(L.admit(`hit.k${i}`, def({ priority: 0 }), 0.006 * (i + 1), 0.001).ok).toBe(true);
    expect(L.admit('hit.more', def({ priority: 0 }), 0.006 * (BUDGET_BURST + 1), 0.001)).toMatchObject({ ok: false, reason: 'budget' });
  });
});

describe('capFrame', () => {
  test('caps per category, one fire per kind, uncategorised always pass', () => {
    const items = [
      { id: 'f1', cat: 'fire', key: 'a' }, { id: 'f2', cat: 'fire', key: 'a' }, { id: 'f3', cat: 'fire', key: 'b' },
      { id: 'h1', cat: 'hit', key: 'x', score: 1 }, { id: 'h2', cat: 'hit', key: 'x', score: 3 }, { id: 'h3', cat: 'hit', key: 'x', score: 2 },
      { id: 's1', cat: 'status', key: 'burn' }, { id: 's2', cat: 'status', key: 'burn' }, { id: 's3', cat: 'status', key: 'freeze' },
      { id: 'leak' }, { id: 'wave' },
    ];
    const ids = capFrame(items).map((i) => i.id).sort();
    expect(ids).toEqual(['f1', 'f3', 'h2', 'h3', 'leak', 's1', 's3', 'wave'].sort());
  });
});

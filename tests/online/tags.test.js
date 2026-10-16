// Player tags on the client (src/online/tags.js): the pure helpers (normalize, chip order, title
// gating, own marks) and the batched cache (debounce, ≤ 100 ids per request, in-flight de-dupe, the
// 10-minute TTL, listeners, a missing table → no tags for the session, offline → a minute's pause).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeTags, chipKinds, tagTitleIds, tagTitleAllowed, createTagCache, recordTagMarks, NO_TAGS,
  TAGS_TTL_MS, TAGS_RETRY_MS, TAGS_BATCH_MAX,
} from '../../src/online/tags.js';
import { TAG_INFO, TAG_TITLE_ROWS, markedTags, isTagTitle } from '../../src/data/playerTags.js';
import { OnlineError } from '../../src/online/errors.js';

describe('pure helpers', () => {
  it('normalizeTags keeps only known values', () => {
    expect(normalizeTags({ staff: 'dev', tester: 'alpha' })).toEqual({ staff: 'dev', tester: 'alpha' });
    expect(normalizeTags({ staff: 'admin', tester: 'gamma' })).toBe(NO_TAGS);
    expect(normalizeTags({ user_id: 'x', staff: null, tester: 'beta' })).toEqual({ staff: null, tester: 'beta' });
    expect(normalizeTags(null)).toBe(NO_TAGS);
    expect(normalizeTags('dev')).toBe(NO_TAGS);
    expect(normalizeTags({ staff: 'DEV' })).toBe(NO_TAGS); // never a guess
  });

  it('chipKinds: DEV beats ALPHA beats BETA; one chip in tight places, all on cards', () => {
    expect(chipKinds({ staff: 'dev', tester: 'alpha' })).toEqual(['dev']);
    expect(chipKinds({ staff: 'dev', tester: 'alpha' }, { all: true })).toEqual(['dev', 'alpha']);
    expect(chipKinds({ staff: null, tester: 'alpha' })).toEqual(['alpha']);
    expect(chipKinds({ staff: 'dev', tester: 'beta' }, { all: true })).toEqual(['dev', 'beta']);
    expect(chipKinds({ tester: 'beta' }, { all: true })).toEqual(['beta']);
    expect(chipKinds(null, { all: true })).toEqual([]);
    expect(chipKinds(NO_TAGS)).toEqual([]);
  });

  it('tag titles: ids in chip order; another player\'s tag title shows only when the server backs it', () => {
    expect(tagTitleIds({ staff: 'dev', tester: 'alpha' })).toEqual(['tag_dev', 'tag_alpha']);
    expect(tagTitleIds({ tester: 'beta' })).toEqual(['tag_beta']);
    expect(tagTitleIds(null)).toEqual([]);
    // ordinary titles: always
    expect(tagTitleAllowed('a_gold_40', null)).toBe(true);
    expect(tagTitleAllowed(null, null)).toBe(true);
    // tag titles: only with the matching server tag (unknown tags: hidden)
    expect(tagTitleAllowed('tag_alpha', { tester: 'alpha' })).toBe(true);
    expect(tagTitleAllowed('tag_alpha', { tester: 'beta' })).toBe(false);
    expect(tagTitleAllowed('tag_dev', { staff: 'dev', tester: 'alpha' })).toBe(true);
    expect(tagTitleAllowed('tag_dev', { staff: null, tester: 'alpha' })).toBe(false); // a removed developer
    expect(tagTitleAllowed('tag_beta', null)).toBe(false);
    expect(tagTitleAllowed('tag_beta', NO_TAGS)).toBe(false);
  });

  it('the vocabulary: chips, labels, titles and marks line up', () => {
    expect(Object.values(TAG_INFO).map((t) => t.chip)).toEqual(['DEV', 'ALPHA', 'BETA']);
    expect(Object.values(TAG_INFO).map((t) => t.label)).toEqual(['Developer', 'Alpha Tester', 'Beta Tester']);
    for (const [kind, t] of Object.entries(TAG_INFO)) {
      expect(t.mark).toBe(`tag:${kind}`);
      expect(TAG_TITLE_ROWS.find((r) => r.id === t.title)?.tag).toBe(kind);
      expect(isTagTitle(t.title)).toBe(true);
    }
    expect(isTagTitle('a_gold_40')).toBe(false);
    expect(isTagTitle('toString')).toBe(false);
  });

  it('recordTagMarks adds marks once and never removes one', () => {
    const p = { missions: { counters: {} } };
    expect(recordTagMarks(p, { staff: 'dev', tester: 'alpha' })).toBe(true);
    expect(p.missions.counters).toEqual({ 'tag:dev': 1, 'tag:alpha': 1 });
    expect(recordTagMarks(p, { staff: 'dev', tester: 'alpha' })).toBe(false);
    // the owner removed the DEV tag: the save keeps the cosmetic it already saw
    expect(recordTagMarks(p, { staff: null, tester: 'alpha' })).toBe(false);
    expect(markedTags(p)).toEqual(['dev', 'alpha']);
    expect(recordTagMarks(p, NO_TAGS)).toBe(false);
    const q = {};
    expect(recordTagMarks(q, { tester: 'beta' })).toBe(true);
    expect(q.missions.counters['tag:beta']).toBe(1);
    expect(markedTags({ missions: { counters: { 'tag:alpha': 0, 'tag:beta': '1' } } })).toEqual(['beta']);
  });
});

describe('the batched cache', () => {
  let clock;
  let timers;
  let calls;
  let answer;
  const ROWS = { a: { userId: 'a', staff: 'dev', tester: 'alpha' }, b: { userId: 'b', staff: null, tester: 'alpha' } };
  const make = (opts = {}) => createTagCache({
    fetch: async (ids) => {
      calls.push(ids);
      return answer(ids);
    },
    now: () => clock.t,
    setTimer: (fn, ms) => {
      const t = { fn, ms };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      timers = timers.filter((x) => x !== t);
    },
    ...opts,
  });
  const tick = async () => {
    const run = timers.splice(0);
    for (const t of run) t.fn();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  };

  beforeEach(() => {
    clock = { t: 1_000_000 };
    timers = [];
    calls = [];
    answer = (ids) => ids.map((id) => ROWS[id]).filter(Boolean);
  });

  it('debounces many wants into one request and answers every id (untagged ones too)', async () => {
    const c = make();
    c.want(['a']);
    c.want(['b', 'a', 'c']);
    c.want('c');
    expect(timers).toHaveLength(1);
    expect(c.get('a')).toBeNull();
    const seen = [];
    c.on((ids) => seen.push(...ids));
    await tick();
    expect(calls).toEqual([['a', 'b', 'c']]);
    expect(c.get('a')).toEqual({ staff: 'dev', tester: 'alpha' });
    expect(c.get('b')).toEqual({ staff: null, tester: 'alpha' });
    expect(c.get('c')).toBe(NO_TAGS);
    expect(seen.sort()).toEqual(['a', 'b', 'c']);
  });

  it('at most 100 ids per request', async () => {
    const c = make();
    const ids = Array.from({ length: 250 }, (_, i) => `u${i}`);
    c.want(ids);
    await tick();
    expect(calls.map((x) => x.length)).toEqual([TAGS_BATCH_MAX, TAGS_BATCH_MAX, 50]);
    expect(new Set(calls.flat()).size).toBe(250);
  });

  it('never asks twice for an id in flight or fresh; asks again after 10 minutes', async () => {
    let release;
    answer = (ids) => new Promise((r) => { release = () => r(ids.map((id) => ROWS[id]).filter(Boolean)); });
    const c = make();
    c.want(['a', 'b']);
    await tick();
    expect(calls).toHaveLength(1);
    c.want(['a', 'b']); // in flight
    expect(timers).toHaveLength(0);
    release();
    await tick();
    c.want(['a', 'b']); // fresh
    expect(timers).toHaveLength(0);
    clock.t += TAGS_TTL_MS - 1;
    c.want(['a']);
    expect(timers).toHaveLength(0);
    clock.t += 2;
    answer = (ids) => ids.map((id) => (id === 'a' ? { userId: 'a', staff: null, tester: 'alpha' } : null)).filter(Boolean);
    c.want(['a']);
    // stale tags still show while the refresh is on its way (no flicker)
    expect(c.get('a')).toEqual({ staff: 'dev', tester: 'alpha' });
    const seen = [];
    c.on((ids) => seen.push(...ids));
    await tick();
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(['a']);
    expect(c.get('a')).toEqual({ staff: null, tester: 'alpha' }); // the owner removed the developer tag
    expect(seen).toEqual(['a']);
  });

  it('listeners hear only real changes', async () => {
    const c = make();
    const seen = [];
    c.on((ids) => seen.push([...ids]));
    c.want(['a', 'b']);
    await tick();
    clock.t += TAGS_TTL_MS + 1;
    c.want(['a', 'b']);
    await tick();
    expect(seen).toEqual([['a', 'b']]);
  });

  it('load() resolves once the batch lands (and at once when fresh)', async () => {
    const c = make();
    const p = c.load('a');
    const q = c.load('b');
    await tick();
    expect(await p).toEqual({ staff: 'dev', tester: 'alpha' });
    expect(await q).toEqual({ staff: null, tester: 'alpha' });
    expect(calls).toEqual([['a', 'b']]);
    expect(await c.load('a')).toEqual({ staff: 'dev', tester: 'alpha' });
    expect(calls).toHaveLength(1);
    expect(await c.load('')).toBeNull();
  });

  for (const [name, err] of [
    ['needs_update (the adapters)', new OnlineError('needs_update', 'Needs the latest server update.')],
    ['42P01', Object.assign(new Error('relation "public.player_tags" does not exist'), { code: '42P01' })],
    ['PGRST205', Object.assign(new Error('Could not find the table'), { code: 'PGRST205' })],
    ['HTTP 404', Object.assign(new Error('Not Found'), { status: 404 })],
  ]) {
    it(`a server without the table (${name}): no tags for the session, no retry`, async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      answer = () => Promise.reject(err);
      const c = make();
      const p = c.load('a');
      c.want(['b']);
      await tick();
      expect(await p).toBeNull();
      expect(c.disabled).toBe(true);
      expect(c.get('a')).toBeNull();
      clock.t += TAGS_TTL_MS * 10;
      c.want(['a', 'b', 'c']);
      expect(timers).toHaveLength(0);
      expect(await c.load('c')).toBeNull();
      expect(calls).toHaveLength(1);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  }

  it('offline: those ids wait a minute (no retry storm), known chips stay', async () => {
    const c = make();
    c.want(['a']);
    await tick();
    clock.t += TAGS_TTL_MS + 1;
    answer = () => Promise.reject(new OnlineError('offline', 'Cannot reach the server.'));
    c.want(['a', 'b']);
    await tick();
    expect(calls).toHaveLength(2);
    expect(c.disabled).toBe(false);
    expect(c.get('a')).toEqual({ staff: 'dev', tester: 'alpha' });
    expect(c.get('b')).toBeNull();
    for (let i = 0; i < 20; i++) c.want(['a', 'b']);
    expect(timers).toHaveLength(0);
    clock.t += TAGS_RETRY_MS + 1;
    answer = (ids) => ids.map((id) => ROWS[id]).filter(Boolean);
    c.want(['a', 'b']);
    await tick();
    expect(calls).toHaveLength(3);
    expect(c.get('b')).toEqual({ staff: null, tester: 'alpha' });
  });

  it('a throwing listener does not stop the others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = make();
    const seen = [];
    c.on(() => { throw new Error('boom'); });
    const off = c.on((ids) => seen.push(...ids));
    c.want(['a']);
    await tick();
    expect(seen).toEqual(['a']);
    off();
    c.want(['b']);
    await tick();
    expect(seen).toEqual(['a']);
    warn.mockRestore();
  });
});

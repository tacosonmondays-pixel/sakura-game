// A tab learns its own tags once (src/ui/online/socialHub.js syncOwnTags) and keeps them as
// missions.counters marks that are never taken back, so only the real server may set them: the
// browser-local stand-in ("Online features offline": no project configured, or Supabase could not
// load) makes up an ALPHA tag for every player and must never write a mark.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProfile } from '../../src/systems/save.js';

const fake = vi.hoisted(() => ({
  calls: 0,
  rows: [],
  store: { profile: null, commits: [], commit(reason) { this.commits.push(reason); } },
}));
vi.mock('../../src/online/backend.js', () => ({
  getBackend: () => ({
    getTags: async (ids) => {
      fake.calls++;
      return fake.rows.filter((r) => ids.includes(r.userId));
    },
  }),
}));
vi.mock('../../src/core/store.js', () => ({ store: fake.store }));

const { syncOwnTags } = await import('../../src/ui/online/socialHub.js');
const { _resetTags, selfId } = await import('../../src/online/tags.js');

const marks = (p) => Object.keys(p.missions?.counters || {}).filter((k) => k.startsWith('tag:')).sort();

beforeEach(() => {
  _resetTags();
  fake.calls = 0;
  fake.rows = [{ userId: 'u1', staff: null, tester: 'alpha' }];
  fake.store.profile = createProfile();
  fake.store.commits = [];
});

describe('syncOwnTags', () => {
  it('the real server: records the marks once, through the store', async () => {
    const tags = await syncOwnTags({ uid: 'u1', offline: false });
    expect(tags).toEqual({ staff: null, tester: 'alpha' });
    expect(selfId()).toBe('u1');
    expect(marks(fake.store.profile)).toEqual(['tag:alpha']);
    expect(fake.store.commits).toEqual(['tags']);
  });

  for (const reason of ['unreachable', 'no_config'])
    it(`the stand-in server (${reason}): no request, no mark, no own id`, async () => {
      // the facade's `offline` getter: true for 'no_config' and 'unreachable' (never for ?online=local)
      expect(await syncOwnTags({ uid: 'u1', offline: true, status: { reason } })).toBeNull();
      await new Promise((r) => setTimeout(r, 80)); // past the cache's debounce: nothing was queued
      expect(fake.calls).toBe(0);
      expect(marks(fake.store.profile)).toEqual([]);
      expect(fake.store.commits).toEqual([]);
      expect(selfId()).toBeNull();
    });

  it('a tab that never went online does nothing', async () => {
    expect(await syncOwnTags({ uid: null })).toBeNull();
    expect(await syncOwnTags(null)).toBeNull();
    expect(fake.calls).toBe(0);
  });
});

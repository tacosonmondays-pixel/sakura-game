// Tag chip holders (src/ui/online/tagChip.js) on a small fake DOM (the repo has no DOM library): a
// batch paints the holders on the page and the ones built but not attached yet; nothing a screen
// dropped is kept alive by the module (no registry of every holder: the page is the registry), with
// a missing table, with every id already cached, or with rows that are never attached at all.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const net = vi.hoisted(() => ({ calls: 0, fail: null, rows: [] }));
vi.mock('../../src/online/backend.js', () => ({
  getBackend: () => ({
    getTags: async (ids) => {
      net.calls++;
      if (net.fail) throw net.fail;
      return net.rows.filter((r) => ids.includes(r.userId));
    },
  }),
}));

// ---- a fake DOM: enough for dom.js h() and the holders ----------------------------------------
class FakeNode {}
class FakeText extends FakeNode {
  constructor(t) { super(); this.textContent = t; }
}
class FakeEl extends FakeNode {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.attrs = {};
    this.dataset = {};
    this.children = [];
    const cls = new Set();
    this.classList = { add: (c) => cls.add(c), contains: (c) => cls.has(c) };
    this.attached = false;
  }
  get isConnected() { return this.attached; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  replaceChildren(...c) { this.children = c; }
  get childElementCount() { return this.children.filter((c) => c instanceof FakeEl).length; }
}

const page = new Set();
let queries = 0;
const attach = (el) => { el.attached = true; page.add(el); return el; };
const detach = (el) => { el.attached = false; page.delete(el); return el; };
const saved = {};
const settle = () => new Promise((r) => setTimeout(r, 90)); // past the cache's 40 ms debounce + the fetch

let mod;
let tags;
beforeEach(async () => {
  for (const k of ['document', 'Node']) saved[k] = globalThis[k];
  globalThis.Node = FakeNode;
  globalThis.document = {
    createElement: (t) => new FakeEl(t),
    createTextNode: (t) => new FakeText(t),
    querySelectorAll: (sel) => {
      queries++;
      expect(sel).toBe('.tg-chips');
      return [...page].filter((el) => el.classList.contains('tg-chips'));
    },
  };
  page.clear();
  queries = 0;
  net.calls = 0;
  net.fail = null;
  net.rows = [{ userId: 'dev1', staff: 'dev', tester: 'alpha' }, { userId: 'a1', staff: null, tester: 'alpha' }];
  vi.resetModules();
  tags = await import('../../src/online/tags.js');
  mod = await import('../../src/ui/online/tagChip.js');
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) globalThis[k] = v;
});

describe('tag chip holders', () => {
  it('a batch paints the holders on the page and the ones built but not attached yet', async () => {
    const shown = attach(mod.tagChips('dev1'));
    const card = attach(mod.tagChips('dev1', { all: true }));
    const later = mod.tagChips('a1'); // built, attached only after its batch landed
    expect([shown, card, later].map((e) => e.dataset.tags)).toEqual(['', '', '']);
    await settle();
    expect(net.calls).toBe(1);
    expect(shown.dataset.tags).toBe('dev');
    expect(card.dataset.tags).toBe('dev alpha');
    expect(later.dataset.tags).toBe('alpha');
    expect(later.children[0].attrs['aria-label']).toBe('Alpha Tester');
    attach(later);
    expect(later.dataset.tags).toBe('alpha');
  });

  it('every id cached: holders built and dropped are never kept (no batch, no registry)', async () => {
    attach(mod.tagChips('dev1'));
    attach(mod.tagChips('a1'));
    await settle();
    expect(mod._tagChipState().early).toBe(0);
    for (let i = 0; i < 2000; i++) detach(attach(mod.tagChips(i % 2 ? 'dev1' : 'a1'))); // chat lines scrolled away, tab switches
    expect(mod._tagChipState().early).toBe(0);
    await settle();
    expect(net.calls).toBe(1);
    expect(page.size).toBe(2);
  });

  it('no player_tags table: empty holders, nothing kept, no request after the first', async () => {
    net.fail = Object.assign(new Error('Needs the latest server update.'), { code: 'needs_update' });
    mod.tagChips('dev1');
    await settle();
    expect(tags.tagsDisabled()).toBe(true);
    const before = mod._tagChipState().early;
    for (let i = 0; i < 2000; i++) {
      const el = mod.tagChips(`p${i}`);
      expect(el.dataset.tags).toBe('');
      expect(el._tagUid).toBeUndefined();
    }
    await settle();
    expect(mod._tagChipState().early).toBe(before);
    expect(before).toBeLessThanOrEqual(1);
    expect(net.calls).toBe(1);
  });

  it('rows that are never attached (a burst while tags are unknown): at most 200 kept, the oldest go first', async () => {
    net.fail = Object.assign(new Error('offline'), { code: 'offline' }); // ids wait a minute: no batch lands
    for (let i = 0; i < 5000; i++) mod.tagChips(`p${i}`);
    expect(mod._tagChipState().early).toBeLessThanOrEqual(201);
    await settle();
    expect(mod._tagChipState().early).toBeLessThanOrEqual(201);
  });

  it('a batch costs one page query, whatever was built and dropped before', async () => {
    for (let i = 0; i < 500; i++) detach(attach(mod.tagChips('a1')));
    const kept = attach(mod.tagChips('dev1'));
    queries = 0;
    await settle();
    expect(queries).toBe(1);
    expect(kept.dataset.tags).toBe('dev');
    // the rows dropped before their batch landed were painted once and let go
    expect(mod._tagChipState().early).toBe(0);
  });
});

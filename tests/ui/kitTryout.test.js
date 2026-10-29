// [ui-ink] The kit additions Tryout Day asked for (UI v2 menus): a mode wallet counted by count(profile), never writing
// to the save; a side-rail tab's count ("1/4"); a girl tile's own short tag; primaryBtn, the one yellow primary. Each
// is additive: a caller that does not pass the new option gets exactly the old output.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as w from '../../src/ui/wallets.js';
import { stabLabel, sideRail, primaryBtn, secondaryBtn } from '../../src/ui/kit.js';
import { girlTile } from '../../src/ui/components.js';
import { UNITS } from '../../src/data/units.js';

// a small stand-in DOM (vitest runs in node): enough of the element API for dom.js h()
class FakeNode {}
class FakeText extends FakeNode { constructor(t) { super(); this.textContent = t; } }
class FakeEl extends FakeNode {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.attrs = {};
    this.children = [];
    this.dataset = {};
    this.listeners = {};
    this._cls = new Set();
    this.innerHTML = '';
    const props = {};
    this.style = { setProperty: (k, v) => { props[k] = v; }, props };
    this.classList = { add: (c) => this._cls.add(c), contains: (c) => this._cls.has(c), remove: (c) => this._cls.delete(c), toggle: (c, on) => (on ? this._cls.add(c) : this._cls.delete(c)) };
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(k, f) { this.listeners[k] = f; }
  appendChild(c) { this.children.push(c); return c; }
  append(...cs) { for (const c of cs) this.appendChild(typeof c === 'string' ? new FakeText(c) : c); }
  get textContent() { return this.children.map((c) => c.textContent).join(''); }
  /** every descendant element (depth first) */
  all() { return this.children.flatMap((c) => (c instanceof FakeEl ? [c, ...c.all()] : [])); }
  find(cls) { return this.all().find((e) => e.classList.contains(cls)) || null; }
  /** the element's shape: tag, classes, attributes and children, for comparing two builds */
  shape() { return { t: this.tagName, c: this.className, a: this.attrs, d: this.dataset, h: this.innerHTML, k: this.children.map((c) => (c instanceof FakeEl ? c.shape() : c.textContent)) }; }
}
const saved = {};
beforeAll(() => {
  for (const k of ['document', 'Node']) saved[k] = globalThis[k];
  globalThis.Node = FakeNode;
  globalThis.document = { createElement: (t) => new FakeEl(t), createTextNode: (t) => new FakeText(t), body: new FakeEl('body') };
});
afterAll(() => { for (const [k, v] of Object.entries(saved)) globalThis[k] = v; });

describe('(a) registerWallet with count(profile)', () => {
  it('counts through count(profile), whole and never below 0; an item wallet still reads the inventory', () => {
    w.registerWallet({ id: 'kt-passes', count: (p) => p.mode.passes.length, label: 'Hall passes', screens: ['kt-mode'] });
    w.registerWallet({ id: 'kt-item', item: 'kt_marble', label: 'Marbles', screens: ['kt-mode'] });
    const p = { mode: { passes: [1, 2, 3] } };
    const inv = (prof, item) => (item === 'kt_marble' ? 7 : 0);
    expect(w.walletValue('kt-passes', p, inv)).toBe(3);
    expect(w.walletValue('kt-item', p, inv)).toBe(7);
    expect(w.walletValue('coins', p, (_, item) => (item === 'coins' ? 42 : 0))).toBe(42);
    expect(w.walletValue('kt-none', p, inv)).toBe(0);
    w.registerWallet({ id: 'kt-odd', count: () => -2.7, label: 'x', screens: [] });
    expect(w.walletValue('kt-odd', p, inv)).toBe(0);
    w.registerWallet({ id: 'kt-nan', count: () => 'abc', label: 'x', screens: [] });
    expect(w.walletValue('kt-nan', p, inv)).toBe(0);
    expect(w.walletDef('kt-passes').glyph).toBe('sparkles');
    expect(() => w.registerWallet({ id: 'kt-neither', label: 'x', screens: [] })).toThrow(/item or a count/);
  });
  it('count(profile) can never write to the save: a write throws and the save is unchanged', () => {
    w.registerWallet({ id: 'kt-writer', count: (p) => { p.mode.passes.push(9); return 1; }, label: 'x', screens: [] });
    w.registerWallet({ id: 'kt-writer2', count: (p) => { p.gems = 0; return 1; }, label: 'x', screens: [] });
    w.registerWallet({ id: 'kt-writer3', count: (p) => { delete p.mode; return 1; }, label: 'x', screens: [] });
    const p = { gems: 5, mode: { passes: [1] } };
    const before = JSON.stringify(p);
    for (const id of ['kt-writer', 'kt-writer2', 'kt-writer3']) expect(() => w.walletValue(id, p, () => 0), id).toThrow(/must not write/);
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe('(b) a side-rail tab count, and the Tryout glyph aliases', () => {
  it('stabLabel: the count joins the spoken label only when given', () => {
    expect(stabLabel({ id: 'a', label: 'Desk' })).toBe('Desk');
    expect(stabLabel({ id: 'a', label: 'Desk', count: '1/4' })).toBe('Desk, 1/4');
    expect(stabLabel({ id: 'a', label: 'Desk', count: 0 })).toBe('Desk, 0');
    expect(stabLabel({ id: 'a', label: 'Desk', count: '' })).toBe('Desk');
  });
  it('sideRail draws "1/4" at the tab\'s end; a tab without a count is the same as before', () => {
    const tabs = [{ id: 'a', label: 'Desk', count: '1/4' }, { id: 'b', label: 'Hall' }];
    const rail = sideRail(tabs, 'a', () => {});
    const [a, b] = rail.all().filter((e) => e.classList.contains('ui-stab'));
    expect(a.find('ui-stab-count').textContent).toBe('1/4');
    expect(a.getAttribute('aria-label')).toBe('Desk, 1/4');
    expect(b.find('ui-stab-count')).toBe(null);
    const plain = sideRail([{ id: 'b', label: 'Hall' }], 'a', () => {}).all().find((e) => e.classList.contains('ui-stab'));
    expect(plain.shape()).toEqual(b.shape());
  });
});

describe('(c) girlTile tag', () => {
  const id = UNITS.find((u) => u.rarity !== 'UR' && u.kind !== 'hero').id;
  it('an owned girl wears the tag on an ink chip and says it; no tag is the old tile', () => {
    const t = girlTile(id, { level: 12, potential: 0, tag: 'Loaner' });
    const chip = t.all().find((e) => e.dataset.testid === 'card-tag' || e.attrs['data-testid'] === 'card-tag');
    expect(chip.textContent).toBe('Loaner');
    expect(chip.className).toContain('gt-tag');
    expect(t.getAttribute('aria-label')).toContain(', Loaner');
    const plain = girlTile(id, { level: 12, potential: 0 });
    expect(plain.all().some((e) => e.classList.contains('gt-tag'))).toBe(false);
    expect(plain.shape()).toEqual(girlTile(id, { level: 12, potential: 0, tag: null }).shape());
  });
  it('a girl not met yet keeps her join chip and never shows the tag', () => {
    const t = girlTile(id, { owned: false, tag: 'Loaner' });
    expect(t.all().some((e) => e.classList.contains('gt-tag'))).toBe(false);
    expect(t.all().some((e) => e.classList.contains('gt-join'))).toBe(true);
  });
});

describe('(d) primaryBtn', () => {
  it('a yellow primary button with its label, test id and click', () => {
    let hit = 0;
    const b = primaryBtn('Start tryout', { testid: 'kt-go', icon: 'play', onClick: () => hit++ });
    expect(b.tagName).toBe('BUTTON');
    expect(b.className).toBe('ui-btn pri');
    expect(b.getAttribute('data-testid')).toBe('kt-go');
    expect(b.find('btn-label').textContent).toBe('Start tryout');
    expect(b.find('ui-ico')).not.toBe(null);
    b.listeners.click();
    expect(hit).toBe(1);
  });
  it('disabled with a reason: a lock, the reason spoken and shown under it', () => {
    const wrap = primaryBtn('Start tryout', { disabled: true, reason: 'Pick 4 girls' });
    expect(wrap.className).toBe('ui-sec-wrap');
    const b = wrap.children[0];
    expect(b.className).toBe('ui-btn pri');
    expect(b.getAttribute('aria-label')).toBe('Start tryout: Pick 4 girls');
    expect(wrap.find('ui-sec-why').textContent).toBe('Pick 4 girls');
  });
  it('secondaryBtn is untouched (still not yellow)', () => {
    const b = secondaryBtn('Later');
    expect((b.children?.[0] || b).className).not.toContain('pri');
  });
});

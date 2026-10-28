// A small fake DOM for the battle UI's DOM halves (the repo has no DOM library; vitest runs in node): enough for
// dom.js h(), svgEl(), the aim banner, the placement hint, the ability bar's slots, the panel's ability row and the
// pause menu. Elements keep their listeners, attributes and children; click() runs the click listeners.
export class FakeNode {}

export class FakeText extends FakeNode {
  constructor(t) {
    super();
    this.textContent = String(t);
  }
}

export class FakeEl extends FakeNode {
  constructor(tag) {
    super();
    this.tagName = String(tag).toUpperCase();
    this.attrs = {};
    this.dataset = {};
    const vars = {};
    this.style = { setProperty: (k, v) => { vars[k] = v; }, getPropertyValue: (k) => vars[k] ?? '' };
    this.children = [];
    this.hidden = false;
    this.listeners = {};
    this._text = '';
    const cls = new Set();
    this.classList = {
      add: (...c) => c.forEach((x) => cls.add(x)),
      remove: (...c) => c.forEach((x) => cls.delete(x)),
      toggle: (c, on) => {
        const v = on === undefined ? !cls.has(c) : !!on;
        if (v) cls.add(c);
        else cls.delete(c);
        return v;
      },
      contains: (c) => cls.has(c),
    };
  }
  set textContent(t) {
    this._text = String(t);
    this.children = [];
  }
  get textContent() {
    return this._text + this.children.map((c) => c.textContent || '').join('');
  }
  set innerHTML(v) {
    this._html = v;
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  getAttribute(k) {
    return this.attrs[k];
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  }
  /** Runs the listeners of `type` with a plain event object. */
  dispatch(type, e = {}) {
    const ev = { type, target: this, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...e };
    for (const fn of [...(this.listeners[type] || [])]) fn(ev);
    return ev;
  }
  click() {
    return this.dispatch('click');
  }
  appendChild(c) {
    this.children.push(c);
    return c;
  }
  append(...c) {
    this.children.push(...c);
  }
  replaceChildren(...c) {
    this.children = c;
  }
  contains(n) {
    return n === this || this.children.some((c) => c instanceof FakeEl && c.contains(n));
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
  remove() {}
}

/** The first element under `root` (itself included) whose data-testid is `id`, or null. */
export function byTestId(root, id) {
  if (!(root instanceof FakeEl)) return null;
  if (root.attrs['data-testid'] === id) return root;
  for (const c of root.children) {
    const hit = byTestId(c, id);
    if (hit) return hit;
  }
  return null;
}

/** Installs the fake `document` and `Node` globals; returns the function that puts the real ones back. */
export function installFakeDom() {
  const saved = { document: globalThis.document, Node: globalThis.Node };
  globalThis.Node = FakeNode;
  globalThis.document = {
    createElement: (t) => new FakeEl(t),
    createTextNode: (t) => new FakeText(t),
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: { hasAttribute: () => false },
  };
  return () => {
    for (const [k, v] of Object.entries(saved)) globalThis[k] = v;
  };
}

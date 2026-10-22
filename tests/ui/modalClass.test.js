// modal({ cls }) turns its class list into h() dot syntax: a space in cls used to make h() drop every class,
// including .modal itself (the "Awakened to UR!" moment lost its look and showed scrollbars).
import { describe, it, expect } from 'vitest';
import { modalClassSel } from '../../src/ui/components.js';

describe('modalClassSel', () => {
  it('accepts space- or dot-separated classes', () => {
    expect(modalClassSel('ur-ascend-modal gu-ascend-modal')).toBe('.ur-ascend-modal.gu-ascend-modal');
    expect(modalClassSel('a.b')).toBe('.a.b');
    expect(modalClassSel('  one  ')).toBe('.one');
  });
  it('is empty for no class', () => {
    expect(modalClassSel('')).toBe('');
    expect(modalClassSel(null)).toBe('');
  });
  it('builds a selector h() can parse', () => {
    const re = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i; // src/ui/dom.js h()
    expect(re.test(`div.modal${modalClassSel('ur-ascend-modal gu-ascend-modal')}`)).toBe(true);
  });
});

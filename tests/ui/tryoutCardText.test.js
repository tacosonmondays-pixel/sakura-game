import { describe, it, expect } from 'vitest';
import { PEP_CARDS } from '../../src/data/tryout.js';
import { CARD_TEXT, cardText } from '../../src/ui/text/tryout.js';

describe('Tryout Day card text', () => {
  const shipping = Object.entries(PEP_CARDS).filter(([, c]) => c.ship);

  it('every shipping card has display text', () => {
    const missing = shipping.filter(([id]) => !CARD_TEXT[id]).map(([id]) => id);
    expect(missing).toEqual([]);
  });

  it('every shipping card reads cleanly at each of its rarities', () => {
    for (const [id, c] of shipping) {
      for (const r of c.rar) {
        const unit = c.unit || 'aoi';
        const t = cardText({ id, r, unit });
        expect(t.name, `${id} r${r}`).toBeTruthy();
        expect(t.name, `${id} r${r}`).not.toBe(id);
        expect(t.line, `${id} r${r}`).toBeTruthy();
        expect(t.line, `${id} r${r}`).not.toMatch(/undefined|NaN/);
      }
    }
  });
});

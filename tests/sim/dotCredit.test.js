// v0.1.66 audit B-F1: a poison's (or burn's) %-of-max-HP part keeps its own owner through the per-key merge, so when
// another girl's stronger flat dps wins, the part is still credited to the girl who dealt it.
import { describe, it, expect } from 'vitest';
import { applyStatus } from '../../src/sim/status.js';

const enemy = () => ({ dead: false, airborne: false, tier: 'normal', statuses: {}, armorClass: 'light', hp: 1e6, maxHp: 1e6, barrier: 0, armor: 0 });
const MIDORI = { type: 'poison', dps: 10, pct: 0.01, duration: 4 };
const ENA = { type: 'poison', dps: 80, duration: 4 };

describe('the pct part of a DoT keeps its owner', () => {
  it('Midori first, then Ena\'s stronger dps: the dps is Ena\'s, the pct stays Midori\'s', () => {
    const e = enemy();
    applyStatus(e, MIDORI, { sourceUid: 1 });
    applyStatus(e, ENA, { sourceUid: 2 });
    expect(e.statuses.poison).toMatchObject({ dps: 80, pct: 0.01, sourceUid: 2, pctUid: 1 });
  });
  it('Ena first, then Midori: Ena keeps the dps credit, Midori takes the pct', () => {
    const e = enemy();
    applyStatus(e, ENA, { sourceUid: 2 });
    applyStatus(e, MIDORI, { sourceUid: 1 });
    expect(e.statuses.poison).toMatchObject({ dps: 80, pct: 0.01, sourceUid: 2, pctUid: 1 });
  });
  it('one girl: both parts hers, as before', () => {
    const e = enemy();
    applyStatus(e, MIDORI, { sourceUid: 1 });
    applyStatus(e, { ...MIDORI, dps: 20 }, { sourceUid: 1 });
    expect(e.statuses.poison).toMatchObject({ dps: 20, pct: 0.01, sourceUid: 1, pctUid: 1 });
  });
});

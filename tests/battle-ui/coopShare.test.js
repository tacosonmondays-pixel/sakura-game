// Co-op sharing in the drawer (docs/specs/COOP_SHARING.md §3.5): the row that lends a girl, takes her back or hands her
// back (drawerView.shareRowView), and the read-only note on a girl another player commands (sharedAllyNote).
import { describe, it, expect } from 'vitest';
import { shareRowView, sharedAllyNote } from '../../src/ui/battle/drawerView.js';

const base = { me: 0, owner: 0, ctrl: 0, kind: null, allyHere: true, allyName: 'Bea', ownerName: 'Bea', ctrlName: 'Bea' };

describe('shareRowView', () => {
  it('my own girl: "Lend to Bea", armed by the first tap; nothing for a hero, a lab girl, a run, an ended battle or no ally', () => {
    expect(shareRowView(base)).toMatchObject({ kind: 'lend', act: 'lend', button: 'Lend to Bea', disabled: false });
    expect(shareRowView({ ...base, armed: true })).toMatchObject({ kind: 'lend', act: 'lend', button: 'Tap to lend' });
    expect(shareRowView({ ...base, armed: true }).line).toMatch(/pay for her upgrades/);
    for (const k of ['isHero', 'lab', 'run', 'ended']) expect(shareRowView({ ...base, [k]: true })).toBeNull();
    expect(shareRowView({ ...base, allyHere: false })).toBeNull();
  });

  it('mine, with my ally: "Take back", disabled during a wave unless they are gone', () => {
    const lent = { ...base, ctrl: 1, kind: 'lend' };
    expect(shareRowView(lent)).toMatchObject({ kind: 'lentOut', line: 'Lent to Bea', act: 'back', disabled: false, hint: null });
    expect(shareRowView({ ...lent, wave: true })).toMatchObject({ act: 'back', disabled: true, hint: 'Between waves' });
    expect(shareRowView({ ...lent, wave: true, ctrlGone: true })).toMatchObject({ act: 'back', disabled: false });
    expect(shareRowView({ ...lent, ended: true })).toMatchObject({ act: null, button: null });
  });

  it('lent to me: "Give back" any time; handed over by a player who left: theirs while they are away, no give-back to nobody', () => {
    const lentIn = { ...base, owner: 1, ctrl: 0, kind: 'lend' };
    expect(shareRowView(lentIn)).toMatchObject({ kind: 'lentIn', line: 'Lent by Bea', act: 'give', button: 'Give back' });
    expect(shareRowView({ ...lentIn, wave: true })).toMatchObject({ act: 'give', disabled: false });
    const dealt = { ...lentIn, kind: 'deal', ownerGone: true };
    expect(shareRowView(dealt)).toMatchObject({ kind: 'lentIn', act: null, button: null });
    expect(shareRowView(dealt).line).toMatch(/yours while they are away/);
  });

  it('nobody\'s row on an ally\'s own girl (the read-only note says it)', () => {
    expect(shareRowView({ ...base, owner: 1, ctrl: 1 })).toBeNull();
  });
});

describe('sharedAllyNote', () => {
  it('names whoever commands her; says when she is mine but lent; they/them for players', () => {
    expect(sharedAllyNote('Bea', 'Bea').title).toBe("Bea's girl — only Bea can upgrade, retarget or sell her.");
    expect(sharedAllyNote('Bea', 'Cho').title).toBe("Cho's girl, with Bea now — only Bea can upgrade, retarget or sell her.");
    expect(sharedAllyNote('Bea', 'Aiko', { mine: true }).title).toMatch(/^Your girl, lent to Bea — they give her orders now/);
    expect(sharedAllyNote('Bea', 'Aiko', { mine: true, wide: false }).text).toBe('Lent to Bea · view only');
  });
});
